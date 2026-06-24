# Master Catalog — Prolifics Agentic Advantage

A single place to discover, govern, and share every AI agent and tool built at Prolifics. The catalog is the company's authoritative view of its agentic portfolio — updated automatically as toolkits are developed, visible to every developer, and designed to give leadership a clear picture of the agentic advantage journey.

Four moving parts:
1. **Catalog backend** — stores published toolkit snapshots, persists assembly structure and accumulated token usage.
2. **Toolkit-workbench publisher** — a push action in the workbench that extracts assembly metadata and optional token stats and posts them to the catalog API.
3. **Catalog UI** — an elegant read-only UI with views across consumers, personas, assemblies, agents, and tools, plus an executive dashboard.
4. **Fly.io deployment** — the whole app (FastAPI + React) runs in a single container on Fly.io with a persistent volume for the SQLite database, following the same pattern as the `road-signs-flashcards` peer app.

---

## Epic: Catalog Backend

Persistent store for toolkit snapshots and accumulated token statistics. Lives in `ai-catalog`. Designed so multiple pushes from different machines or different points in time accumulate cleanly — assembly structure always reflects the latest push; token stats are additive.

---

### CAT-1: Catalog data schema

**Type:** backend
**Status:** proposed
**Epic:** Catalog Backend
**Repo:** `ai-catalog`

**As a** catalog API,
**I want** a well-defined schema that captures the full structure of a toolkit snapshot and its accumulated token stats,
**so that** every other story has a stable, consistent data model to build against.

**Acceptance Criteria:**
- [ ] SQLite database (consistent with toolkit-workbench) with the following tables:
  - `toolkits` — `id`, `name`, `description`, `repo_url`, `owner`, `tags`, `git_branch`, `git_last_commit`, `git_is_dirty` (INTEGER 0/1), `first_published_at`, `last_published_at`
  - `assemblies` — `id`, `toolkit_id`, `name`, `description`, `gateway_port`, `raw_yaml` (full serialised assembly block), `published_at`
  - `consumers` — `id`, `assembly_id`, `toolkit_id`, `name`, `description`
  - `personas` — `id`, `assembly_id`, `toolkit_id`, `name`, `description`, `capability_count`
  - `agents` — `id`, `toolkit_id`, `name`, `description`, `tools_used` (JSON array of tool names), `llm_class`, `model`
  - `tools` — `id`, `toolkit_id`, `name`, `description`, `input_schema` (JSON), `output_description`
  - `token_stats` — `id`, `toolkit_id`, `capability_name`, `call_count`, `total_input_tokens`, `total_output_tokens`, `avg_input_tokens`, `avg_output_tokens`, `avg_cost_usd`, `provider`, `last_updated_at`
- [ ] On re-publish of a toolkit: assembly/agent/tool rows for that toolkit are replaced (latest wins); token_stats rows are NOT replaced — they are accumulated (see CAT-3)
- [ ] `token_stats.call_count`, `total_input_tokens`, `total_output_tokens` are running totals — never overwritten, only incremented
- [ ] `avg_input_tokens`, `avg_output_tokens`, `avg_cost_usd` are recomputed as `total / call_count` on each accumulation
- [ ] DB migration file at `api/migrations/V1__initial_schema.sql`

**Notes:**
- SQLite chosen for zero-infrastructure deployment consistent with toolkit-workbench (`aiosqlite`)
- `raw_yaml` on assemblies preserves the original YAML for the "download full spec" feature (CAT-4)
- `tags` on toolkits is a comma-separated string (e.g. `"hr,onboarding,prolifics-client"`) — no separate tag table for v1

---

### CAT-2: Push API

**Type:** backend
**Status:** proposed
**Epic:** Catalog Backend
**Repo:** `ai-catalog`

**As a** toolkit-workbench publisher,
**I want** a single `POST /api/catalog/push` endpoint that accepts a full toolkit snapshot,
**so that** the workbench can publish or update a toolkit's catalog entry with one call.

**Acceptance Criteria:**
- [ ] `POST /api/catalog/push` accepts a JSON body matching the `ToolkitSnapshot` schema:
  ```json
  {
    "toolkit": {
      "name", "description", "repo_url", "owner", "tags",
      "git_branch", "git_last_commit", "git_is_dirty"
    },
    "assemblies": [{ "name", "description", "gateway_port", "raw_yaml", "consumers": [...], "personas": [...] }],
    "agents": [{ "name", "description", "tools_used", "llm_class", "model" }],
    "tools": [{ "name", "description", "input_schema", "output_description" }],
    "token_stats": [{ "capability_name", "call_count", "total_input_tokens", "total_output_tokens", "avg_cost_usd", "provider" }]
  }
  ```
- [ ] `git_branch`, `git_last_commit`, `git_is_dirty` are all optional — if absent the catalog stores `NULL` for those fields; a push that includes them overwrites whatever was previously stored
- [ ] `token_stats` is optional — if absent or empty, existing token stats are untouched (accumulation never resets)
- [ ] Returns `{ toolkit_id, published_at, assemblies_written, agents_written, tools_written, token_stats_updated }` on success
- [ ] If `toolkit.name` matches an existing toolkit, updates it (upsert by name); otherwise creates a new record
- [ ] `POST /api/catalog/push` requires an API key in the `X-Catalog-Key` header — key is configured via environment variable `CATALOG_API_KEY`; returns `401` if missing or wrong
- [ ] `GET /api/health` returns `{ status: "ok" }` — used by toolkit-workbench to verify catalog reachability before pushing

**Notes:**
- API key is intentionally simple (single shared secret) for v1 — no per-toolkit auth
- Upsert match is case-insensitive on `toolkit.name` to avoid duplicates from formatting differences
- The push is atomic at the toolkit level: either all tables update or none do (SQLite transaction)

---

### CAT-3: Token stats accumulation

**Type:** backend
**Status:** proposed
**Epic:** Catalog Backend
**Repo:** `ai-catalog`

**As a** catalog backend,
**I want** token stats from successive pushes to accumulate into running totals and recomputed averages,
**so that** the catalog reflects real observed usage across all runs across all machines, never losing historical data when a new push arrives.

**Acceptance Criteria:**
- [ ] When a push includes `token_stats` for a `capability_name` that already has a row: add `call_count`, `total_input_tokens`, `total_output_tokens` to existing totals; recompute `avg_*` as `total / call_count`; update `last_updated_at`
- [ ] When a push includes `token_stats` for a `capability_name` with no existing row: insert a new row with the supplied values
- [ ] When a push omits `token_stats` entirely: no token_stats rows are touched — the table is left exactly as it was
- [ ] `avg_cost_usd` is accumulated by tracking `total_cost_usd` (sum) separately and computing `avg = total_cost / call_count`; the push payload supplies `avg_cost_usd` + `call_count` so `total_cost = avg * call_count` at accumulation time
- [ ] `GET /api/catalog/toolkits/:id/token-stats` returns all token_stats rows for the toolkit, sorted by `call_count DESC`

**Notes:**
- This means the same capability being pushed from two different team members' machines correctly sums their independent call counts — intentional
- No deduplication of pushes is attempted in v1 — if the same dataset is pushed twice by mistake, totals will double; document this and accept the limitation

---

### CAT-4: Read API

**Type:** backend
**Status:** proposed
**Epic:** Catalog Backend
**Repo:** `ai-catalog`

**As a** catalog UI,
**I want** a clean set of read endpoints covering all entity views,
**so that** the frontend can drive every view (dashboard, toolkits, consumers, personas, agents, tools) from the API without any client-side joins or aggregation.

**Acceptance Criteria:**
- [ ] `GET /api/catalog/stats` — total counts: `{ toolkits, assemblies, consumers, personas, agents, tools, total_calls, total_cost_usd }`
- [ ] `GET /api/catalog/toolkits` — list of all toolkits with `name`, `description`, `owner`, `tags`, `last_published_at`, `git_branch`, `git_is_dirty`, aggregate counts (agents, tools, consumers, personas)
- [ ] `GET /api/catalog/toolkits/:id` — full toolkit detail: all fields plus nested assemblies, agents, tools, consumers, personas, and token_stats
- [ ] `GET /api/catalog/toolkits/:id/spec` — returns the raw `raw_yaml` for the toolkit's assemblies (for the download feature)
- [ ] `GET /api/catalog/consumers` — all consumers across all toolkits with `name`, `toolkit_name`, `assembly_name`
- [ ] `GET /api/catalog/personas` — all personas with `name`, `toolkit_name`, `capability_count`
- [ ] `GET /api/catalog/agents` — all agents with `name`, `description`, `toolkit_name`, `model`, `tools_used`
- [ ] `GET /api/catalog/tools` — all tools with `name`, `description`, `toolkit_name`
- [ ] All list endpoints support `?q=` free-text filter (name + description substring match) and `?toolkit_id=` scoping
- [ ] All endpoints return JSON; no auth required for reads (catalog is intended to be open internally)

**Notes:**
- Aggregate counts on toolkit list are computed with a single SQL query (COUNT + GROUP BY) — not N+1 per toolkit
- `total_calls` and `total_cost_usd` in `/stats` are sums across all `token_stats` rows

---

## Epic: Toolkit-Workbench Publisher

A push action added to toolkit-workbench that extracts the full assembly structure from a running (or stopped) toolkit and posts it to the catalog. Implemented as a new tab or action in the workbench UI and a new FastAPI router in the workbench API.

---

### CAT-5: Assembly extractor

**Type:** backend
**Status:** proposed
**Epic:** Toolkit-Workbench Publisher
**Repo:** `toolkit-workbench`

**As a** workbench publish action,
**I want** to extract a fully structured `ToolkitSnapshot` payload by reading a toolkit's YAML config files,
**so that** the push can send complete, accurate assembly data without requiring the toolkit to be running.

**Acceptance Criteria:**
- [ ] New function `extract_toolkit_snapshot(toolkit_path: str) -> dict` in `api/routers/catalog.py`
- [ ] Reads `assemblies/assemblies.yaml` → extracts: assembly name, description, gateway_port, consumers (name, description), personas (name, capability_count), raw YAML preserved verbatim
- [ ] Reads `capabilities/config/agents.yaml` → extracts: agent name, description, llm_class, model, list of tool names from `tools:` block
- [ ] Reads `capabilities/config/tools.yaml` → extracts: tool name, description, input_schema (from `parameters:` block), output_description
- [ ] Reads `docs/CATALOG.md` if present → extracts toolkit-level `description`, `owner`, `tags` via YAML front-matter (CAT-W4); falls back to empty strings/list if absent
- [ ] Collects git metadata by running: `git -C {toolkit_path} remote get-url origin` (→ `repo_url`), `git -C {toolkit_path} branch --show-current` (→ `git_branch`), `git -C {toolkit_path} log -1 --pretty=format:%h %s` (→ `git_last_commit`), `git -C {toolkit_path} status --porcelain` (non-empty output → `git_is_dirty: true`)
- [ ] If the toolkit path is not a git repo, git fields are omitted from the payload (no error); `repo_url` falls back to whatever was set in `docs/CATALOG.md` front-matter
- [ ] Returns a dict matching the `ToolkitSnapshot` schema from CAT-2 (no `token_stats` key — that is populated separately by CAT-7)
- [ ] `GET /api/toolkits/:tid/catalog/preview` calls `extract_toolkit_snapshot` and returns the payload so the workbench UI can show what will be sent before the user clicks Publish

**Notes:**
- Git commands reuse the same subprocess pattern already present in `GET /{tid}/git` in `toolkits.py` — extract a shared `_run_git(path, *args)` helper rather than duplicating
- Uses the same YAML parsing already in `_infer_gateway_port` and `_infer_capabilities_port` — extend rather than duplicate
- If a YAML file is missing or malformed, the extractor logs a warning and continues with partial data rather than failing the whole push

---

### CAT-6: Catalog push action in workbench

**Type:** ux | backend
**Status:** proposed
**Epic:** Toolkit-Workbench Publisher
**Repo:** `toolkit-workbench`

**As a** toolkit developer,
**I want** a "Publish to Catalog" action in the toolkit-workbench UI,
**so that** I can register or update my toolkit in the master catalog with one click.

**Acceptance Criteria:**
- [ ] A new **Catalog** tab is added to the toolkit detail view in the workbench UI (alongside Overview, Config, Logs)
- [ ] The Catalog tab shows: current catalog entry status (published / not yet published), last publish date, a preview of the extracted snapshot (assembly name, agent count, tool count, consumer count), and a "Publish to Catalog" button
- [ ] Clicking "Publish to Catalog": calls `POST /api/toolkits/:tid/catalog/push` on the workbench backend, which calls `extract_toolkit_snapshot` then forwards to the catalog `POST /api/catalog/push`
- [ ] `POST /api/toolkits/:tid/catalog/push` accepts an optional `include_token_stats: bool` flag (default `false`) — if `true`, also collects token stats (CAT-7) and includes them in the payload
- [ ] The catalog URL and API key are configured in workbench settings (`CATALOG_URL`, `CATALOG_API_KEY` env vars); if not configured, the Catalog tab shows a setup prompt rather than erroring silently
- [ ] On success, the tab shows a success banner with the publish timestamp and counts from the catalog response
- [ ] On failure (catalog unreachable, auth error), the tab shows the error clearly with the raw response — no silent failures

**Notes:**
- The workbench is the only publisher in v1 — no direct CLI push command in the toolkit itself; that can come later
- `CATALOG_URL` defaults to `http://localhost:8300` if not set — allows running catalog locally during development

---

### CAT-7: Token stats collection

**Type:** backend
**Status:** proposed
**Epic:** Toolkit-Workbench Publisher
**Repo:** `toolkit-workbench`

**As a** workbench catalog publisher,
**I want** to collect token usage aggregates from the workbench's own session records and include them in the catalog push payload,
**so that** the catalog accumulates real cost and usage data from every developer's machine over time without anyone manually recording numbers.

**Acceptance Criteria:**
- [ ] New function `collect_token_stats(toolkit_id: str, db: aiosqlite.Connection) -> list[dict]` in `api/routers/catalog.py`
- [ ] Queries the workbench `sessions` table: `SELECT requested_capability, COUNT(*) AS call_count, SUM(prompt_tokens) AS total_input_tokens, SUM(completion_tokens) AS total_output_tokens, SUM(estimated_cost_usd) AS total_cost_usd FROM sessions WHERE toolkit_id = ? AND prompt_tokens IS NOT NULL GROUP BY requested_capability`
- [ ] Maps each row to a `token_stats` entry: `capability_name`, `call_count`, `total_input_tokens`, `total_output_tokens`, `avg_input_tokens` (total/count), `avg_output_tokens` (total/count), `avg_cost_usd` (total_cost/count), `provider` (read from `sessions.source` or hardcoded from `envconfig.yaml` active provider — whichever is available)
- [ ] Returns an empty list if no sessions with token data exist — no error
- [ ] The workbench Catalog tab shows "Include token stats from N sessions" checkbox (pre-ticked if sessions with token data exist) before the publish action
- [ ] `POST /api/toolkits/:tid/catalog/push?include_token_stats=true` invokes this function and merges the result into the push payload

**Notes:**
- The `sessions` table already has `prompt_tokens`, `completion_tokens`, `total_tokens`, `estimated_cost_usd` — this is the correct source, not execution JSON files
- Stats represent this developer's local workbench only — other team members' stats accumulate in the catalog when they push from their own workbench instances (CAT-3 handles the server-side merge)
- `provider` field: read `active_provider` from `capabilities/config/envconfig.yaml` using the existing `parse_envconfig` helper in `toolkits.py`

---

## Epic: Workbench — Internal Changes

Changes inside the toolkit-workbench itself that are prerequisites for the publisher stories (CAT-5 through CAT-7) and make the catalog integration a first-class feature rather than a bolt-on.

---

### CAT-W1: Register catalog router and add DB migrations

**Type:** backend
**Status:** proposed
**Epic:** Workbench — Internal Changes
**Repo:** `toolkit-workbench`

**As a** workbench API,
**I want** the catalog router registered in `main.py` and the database schema extended with catalog tracking columns,
**so that** the catalog push feature is wired in from startup and the workbench can track publish state per toolkit.

**Acceptance Criteria:**
- [ ] New file `api/routers/catalog.py` created (see CAT-5, CAT-6, CAT-7 for its contents)
- [ ] `main.py` imports and registers the catalog router: `from routers.catalog import router as catalog_router` + `app.include_router(catalog_router)`
- [ ] `database.py` adds a migration for `toolkits`: `ALTER TABLE toolkits ADD COLUMN catalog_published_at TEXT` — executed safely in `init_db` with a `try/except` guard (existing migration pattern)
- [ ] `database.py` adds a `workbench_settings` table: `CREATE TABLE IF NOT EXISTS workbench_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)` — stores `CATALOG_URL` and `CATALOG_API_KEY` with env var as fallback
- [ ] New router `api/routers/settings.py` with `GET /api/settings` (returns all key/value pairs) and `PUT /api/settings` (accepts `{ key: string, value: string }` — upserts a single setting); registered in `main.py`
- [ ] Catalog router reads `CATALOG_URL` and `CATALOG_API_KEY` by checking: (1) `workbench_settings` table, (2) environment variables — in that order

**Notes:**
- `workbench_settings` stores values as plain text — `CATALOG_API_KEY` stored here is no more or less secure than an env var on a local dev machine; acceptable for v1
- The settings router is minimal — no auth, no validation beyond key name; the catalog router is the only consumer in v1 but the pattern is reusable

---

### CAT-W2: Workbench catalog settings UI

**Type:** ux
**Status:** proposed
**Epic:** Workbench — Internal Changes
**Repo:** `toolkit-workbench`

**As a** developer setting up the catalog push feature,
**I want** a settings section in the workbench UI where I can enter the catalog URL and API key,
**so that** I don't need to restart the workbench process or edit environment files to configure the catalog connection.

**Acceptance Criteria:**
- [ ] A **Settings** page (or section within the existing workbench settings area) exposes two fields: `Catalog URL` (default `http://localhost:8300`) and `Catalog API Key` (masked input)
- [ ] Saving the form calls `PUT /api/settings` for each field; a success toast confirms the save
- [ ] The API key field shows `••••••••` after save and requires a deliberate "Edit" click to reveal and change — prevents casual screen-share leaks
- [ ] The Catalog tab on any toolkit (CAT-6) shows a "Not configured" prompt with a link to this settings page if `CATALOG_URL` is absent from both the settings table and env vars
- [ ] A "Test connection" button on the settings page calls `GET {CATALOG_URL}/api/health` and shows a green tick or red error inline

**Notes:**
- The settings page can be a new top-level nav item ("Settings") or appended to an existing one — match the workbench's existing navigation conventions
- The API key is never surfaced back to the UI after first save — `GET /api/settings` returns `CATALOG_API_KEY` as `"••••••••"` (masked) if set

---

### CAT-W3: Workbench home — catalog publish status

**Type:** ux
**Status:** proposed
**Epic:** Workbench — Internal Changes
**Repo:** `toolkit-workbench`

**As a** developer at the workbench home view,
**I want** to see at a glance which toolkits have been published to the catalog and whether they might be stale,
**so that** I know which toolkits need a publish run before sharing with the company.

**Acceptance Criteria:**
- [ ] The toolkit list on the home view adds a **Catalog** status indicator column (or chip on the toolkit card)
- [ ] Three states: **Published** (green — shows date of `catalog_published_at`), **Never published** (grey), **Possibly stale** (amber — `catalog_published_at` is set but the toolkit has been started since that date, implying it may have changed)
- [ ] "Possibly stale" is detected as: `catalog_published_at IS NOT NULL AND last_started_at > catalog_published_at`
- [ ] Clicking the chip navigates to the Catalog tab on that toolkit's detail view
- [ ] `catalog_published_at` is updated by the workbench catalog router (`api/routers/catalog.py`) on every successful push response from the catalog API

**Notes:**
- "Possibly stale" is a heuristic — a toolkit that was started for testing but not changed is still flagged amber; acceptable in v1 since a redundant publish is harmless

---

### CAT-W4: Toolkit template — structured CATALOG.md front-matter

**Type:** backend
**Status:** proposed
**Epic:** Workbench — Internal Changes
**Repo:** `toolkit-workbench`

**As a** catalog extractor (CAT-5),
**I want** a structured YAML front-matter block at the top of `docs/CATALOG.md` in every scaffolded toolkit,
**so that** the extractor can reliably read `description`, `owner`, and `tags` without resorting to heuristic text parsing.

**Acceptance Criteria:**
- [ ] Both scaffold templates (`templates/aaf/docs/CATALOG.md` and `templates/aaf-no-example/docs/CATALOG.md`) are updated to include a YAML front-matter block at the very top:
  ```
  ---
  description: "One sentence describing what this toolkit does."
  owner: ""
  tags: []
  ---
  ```
- [ ] The placeholder text in the front-matter makes the required fields self-documenting — a developer filling it in does not need to read docs
- [ ] The extractor (CAT-5) reads front-matter with `python-frontmatter` (or equivalent): parses `description`, `owner`, `tags` from the YAML block; falls back to empty strings/empty list if the file is absent or front-matter is missing — never errors
- [ ] The `__DISPLAY__` title placeholder in the existing template is preserved and documented: the scaffold replaces it with the actual toolkit name when creating a toolkit (same as existing scaffold behaviour)
- [ ] The existing `## Agents` and `## Tools` sections below the front-matter are unchanged — they remain human-maintained prose

**Notes:**
- `python-frontmatter` is a lightweight library (`pip install python-frontmatter`); add to `api/requirements.txt`
- The `tags` field is a YAML list (e.g. `["hr", "onboarding"]`) — the extractor joins it to a comma-separated string for the catalog push payload (matching CAT-2's `toolkit.tags` shape)

---

## Epic: Catalog UI

An elegant, read-only single-page application that lives in `ai-catalog/ui`. Five browsable views — consumers, personas, assemblies, agents, tools — plus a home dashboard with live counts and an executive summary. Designed to be published to the whole company and shared directly with the CEO as a live view of the agentic advantage journey.

---

### CAT-8: Home dashboard

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI
**Repo:** `ai-catalog`

**As a** catalog visitor,
**I want** a striking home dashboard that gives an immediate sense of the scale and health of Prolifics' agentic portfolio,
**so that** anyone — developer or executive — can see at a glance how far the journey has come.

**Acceptance Criteria:**
- [ ] Hero section: large animated count-up numbers for `Toolkits`, `Assemblies`, `Agents`, `Tools`, `Consumers`, `Personas` — sourced from `GET /api/catalog/stats`
- [ ] "Total AI Capability Calls" and "Estimated Total Cost" shown as secondary metrics below the hero counts if token stats exist
- [ ] Toolkit timeline: a chronological strip showing when each toolkit was first published — gives a visual sense of momentum
- [ ] "Recently updated" rail: last 5 toolkits ordered by `last_published_at`, each shown as a card with name, owner, agent count, tool count
- [ ] Top capabilities by call count: a ranked list of the top 10 capabilities across all toolkits by `call_count` (from token_stats)
- [ ] The page is fully responsive; on narrow screens the hero counts stack vertically
- [ ] A persistent top nav links to: Home, Toolkits, Agents, Tools, Consumers & Personas

**Notes:**
- Count-up animation runs once on first load (not on every re-render); use an Intersection Observer to trigger when the section enters the viewport
- Colour palette: dark background with accent colours matching Prolifics brand (confirm with stakeholder before implementing); fallback to a sophisticated charcoal + gold scheme

---

### CAT-9: Toolkits browser

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI
**Repo:** `ai-catalog`

**As a** developer or consumer browsing the catalog,
**I want** to browse all published toolkits in a searchable, filterable card grid,
**so that** I can find the toolkit I need and understand what it offers before clicking through to the detail.

**Acceptance Criteria:**
- [ ] Card grid sourced from `GET /api/catalog/toolkits`; each card shows: toolkit name, owner, description (truncated to 2 lines), tags (as chips), agent count, tool count, consumer count, last published date, git branch (small monospace chip if set), and a subtle `⚠` dirty flag if `git_is_dirty` is true
- [ ] Search bar filters cards in real time by name, description, and tags (client-side on loaded data — no server round-trip per keystroke)
- [ ] Filter chips for tags allow narrowing to a subset (multi-select; OR logic)
- [ ] Cards are sorted by `last_published_at` descending by default; toggle to sort by name A–Z or by agent count
- [ ] Clicking a card navigates to the toolkit detail view (CAT-10)
- [ ] Empty state: if no toolkits are published yet, shows a friendly message and a link to the workbench push docs

**Notes:**
- Cards should feel premium — subtle border, slight shadow, hover lift; not boxy or utilitarian
- Tag chips use distinct accent colours per tag to aid scannability (hash tag name to a palette of 8 colours)

---

### CAT-10: Toolkit detail view

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI
**Repo:** `ai-catalog`

**As a** developer evaluating a toolkit,
**I want** to see the full detail of a toolkit — its assemblies, agents, tools, consumers, personas, and token usage history,
**so that** I can make an informed decision about using or contributing to it.

**Acceptance Criteria:**
- [ ] Header: toolkit name, owner, description, tags, last published date
- [ ] **Git provenance row** beneath the header title: branch name (chip), last commit hash + message (monospace), and a `⚠ published with uncommitted changes` warning badge if `git_is_dirty` is true; repo link icon (if `repo_url` set) opens the remote in a new tab — entire row is omitted if all git fields are NULL
- [ ] **Assembly section**: for each assembly, show name, description, gateway port, consumers (names), personas (names + capability count); a "Download spec" button fetches `GET /api/catalog/toolkits/:id/spec` and triggers a YAML file download
- [ ] **Agents section**: table of agents with name, description, model, tools used (linked chips); clicking a tool chip scrolls to that tool in the tools section
- [ ] **Tools section**: table of tools with name, description, input schema summary, output description
- [ ] **Token usage section**: table of capabilities ranked by `call_count` with columns: Capability, Calls, Avg Input Tokens, Avg Output Tokens, Avg Cost (USD), Provider; shown only if token_stats exist
- [ ] **Total usage bar** at bottom of token section: total calls and total estimated cost across all capabilities for this toolkit
- [ ] A breadcrumb `Home > Toolkits > [Name]` sits above the header for navigation
- [ ] All sections are collapsible with an expand/collapse chevron

**Notes:**
- "Download spec" triggers a browser download of the raw `raw_yaml` as `{toolkit-name}-spec.yaml` — no server-side rendering needed; blob URL from the API response
- If `repo_url` is set, the repo link opens in a new tab; if it's a GitHub URL, show the GitHub Octocat favicon inline

---

### CAT-11: Consumers & Personas view

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI
**Repo:** `ai-catalog`

**As a** developer or team lead,
**I want** a cross-toolkit view of all consumers and personas,
**so that** I can see which surface areas (IDE, portal, CLI) are covered by which toolkits without drilling into each one individually.

**Acceptance Criteria:**
- [ ] Two tabs: **Consumers** and **Personas**
- [ ] Consumers tab: list of all consumers grouped by toolkit; each row shows consumer name, toolkit name, assembly name; a search/filter narrows by consumer name or toolkit
- [ ] Personas tab: list of all personas grouped by toolkit; each row shows persona name, toolkit name, capability count; clicking a persona name navigates to the toolkit detail (CAT-10) and scrolls to that persona in the assembly section
- [ ] Total counts at the top of each tab: "N consumers across M toolkits", "N personas across M toolkits"
- [ ] Both tabs are sourced from `GET /api/catalog/consumers` and `GET /api/catalog/personas` respectively

---

### CAT-12: Agents catalog view

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI
**Repo:** `ai-catalog`

**As a** developer looking for an existing agent to reuse or reference,
**I want** a searchable, cross-toolkit list of all published agents,
**so that** I can discover what has already been built and avoid duplicating work.

**Acceptance Criteria:**
- [ ] Sourced from `GET /api/catalog/agents`
- [ ] Table with columns: Agent Name, Toolkit, Model, Tools Used (count + tooltip listing names), Description
- [ ] Search filters by agent name and description (client-side)
- [ ] Filter by toolkit (dropdown) and by model (dropdown)
- [ ] Clicking an agent name navigates to the parent toolkit detail (CAT-10) and scrolls to that agent
- [ ] Total agent count shown above the table: "N agents across M toolkits"

---

### CAT-13: Tools catalog view

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI
**Repo:** `ai-catalog`

**As a** developer looking for an existing tool to reuse,
**I want** a searchable, cross-toolkit list of all published tools,
**so that** I can find tools that already solve my problem before building a new one.

**Acceptance Criteria:**
- [ ] Sourced from `GET /api/catalog/tools`
- [ ] Table with columns: Tool Name, Toolkit, Description, Input Schema (abbreviated — expandable), Output Description
- [ ] Search filters by tool name and description (client-side)
- [ ] Filter by toolkit (dropdown)
- [ ] Clicking a tool name navigates to the parent toolkit detail (CAT-10) and scrolls to that tool
- [ ] Total tool count shown above the table: "N tools across M toolkits"

---

### CAT-14: Executive summary view

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI
**Repo:** `ai-catalog`

**As a** Prolifics CEO or executive stakeholder,
**I want** a single page that shows the breadth and momentum of the agentic advantage programme,
**so that** I can track progress, share it with the board, and use it as evidence of strategic differentiation.

**Acceptance Criteria:**
- [ ] Accessible at `/executive` — a clean, print-friendly page with no navigation chrome or sidebars
- [ ] **Portfolio at a glance**: large stat tiles — Toolkits Deployed, Agents Built, Tools Available, Total AI Capability Calls, Estimated AI Cost Savings (leave this blank/TBD in v1 unless a cost-saving formula is agreed)
- [ ] **Journey timeline**: horizontal timeline of toolkit first-publish dates, labelled by toolkit name — shows cadence of delivery
- [ ] **Coverage by domain**: a simple bar or bubble chart grouped by toolkit `tags` — shows breadth across business domains (HR, SDLC, ETL, etc.)
- [ ] **Top 10 most-used capabilities**: ranked list by total `call_count` with capability name, toolkit, and call count — shows where AI is being actively used
- [ ] **Provider breakdown**: if token_stats include `provider`, show a split of usage by provider (Claude vs GPT vs Gemini etc.)
- [ ] A "Share" button copies the URL to clipboard — the page is designed to be shared as-is (no login required to view)
- [ ] Page is styled for executive presentation: generous whitespace, large typography, no data tables — charts and tiles only

**Notes:**
- This view is a key governance and communication artefact — treat the design with the same care as a board slide deck
- "Cost Savings" metric is aspirational in v1; show the tile with a note "Calculation methodology TBD" rather than leaving it out — it signals intent to the audience
- The page should work in print/PDF (CSS `@media print` — hide the "Share" button, ensure charts render)

---

## Epic: Fly.io Deployment

The complete application — FastAPI backend and React frontend — runs as a single container on Fly.io. The SQLite database is persisted on a Fly volume so catalog data survives deploys and machine restarts. Pattern mirrors the `road-signs-flashcards` peer app: multi-stage Dockerfile, `fly.toml` with volume mount and health check, and a `deploy.sh` bootstrap script.

---

### CAT-15: Multi-stage Dockerfile

**Type:** backend
**Status:** proposed
**Epic:** Fly.io Deployment
**Repo:** `ai-catalog`

**As a** Fly.io deployment,
**I want** a multi-stage Dockerfile that builds the React frontend and packages it with the FastAPI backend into a single runtime image,
**so that** the catalog is served entirely from one container with no separate static-file host.

**Acceptance Criteria:**
- [ ] **Stage 1 — frontend build** (`node:20-alpine AS frontend`): copies `ui/`, runs `npm ci` then `npm run build`; output lands in `ui/dist/`
- [ ] **Stage 2 — Python runtime** (`python:3.13-slim AS runtime`): installs `requirements.txt` (FastAPI, uvicorn, aiosqlite, pyyaml); copies `api/` and copies `ui/dist/` from the frontend stage into `api/static/`
- [ ] FastAPI mounts the copied `api/static/` directory as `StaticFiles` at `/` — all non-`/api/` requests are handled by the static mount
- [ ] A catch-all route `GET /{full_path:path}` returns `api/static/index.html` for SPA client-side routing (any path not matched by `/api/*` or the static file server falls through to `index.html`)
- [ ] The app reads `PORT` (default `8080`) and `DATA_DIR` (default `/data`) from environment variables; SQLite DB path is `{DATA_DIR}/catalog.db`
- [ ] `EXPOSE 8080` declared; `CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]`
- [ ] A `.dockerignore` excludes: `.git`, `**/node_modules`, `**/__pycache__`, `**/.venv`, `ui/dist`, `*.pyc`
- [ ] `docker build -t ai-catalog .` from the repo root succeeds; `docker run -p 8080:8080 ai-catalog` serves the app at `localhost:8080`

**Notes:**
- Reference: `road-signs-flashcards/Dockerfile` uses the same deps → builder → runtime three-stage pattern; this variant swaps stage 3 from Node to Python
- `api/static/` is the build-time copy location inside the image; do not create or commit this directory in the repo — it only exists inside the Docker image
- `uvicorn` is used directly (not behind gunicorn) for simplicity in v1 — Fly's single-machine model doesn't require multi-worker HTTP

---

### CAT-16: fly.toml and deploy script

**Type:** backend
**Status:** proposed
**Epic:** Fly.io Deployment
**Repo:** `ai-catalog`

**As a** developer deploying the catalog,
**I want** a `fly.toml` configuration and a `deploy.sh` bootstrap script,
**so that** a first-time deploy is a single command and subsequent deploys are equally simple.

**Acceptance Criteria:**
- [ ] `fly.toml` at repo root with:
  - `app = 'prolifics-ai-catalog'`
  - `primary_region = 'jnb'` (Johannesburg — consistent with road-signs-flashcards)
  - `[[mounts]]` block: `source = 'catalog_data'`, `destination = '/data'` — persists the SQLite DB across deploys
  - `[http_service]`: `internal_port = 8080`, `force_https = true`, `auto_stop_machines = 'stop'`, `auto_start_machines = true`, `min_machines_running = 0`
  - `[[http_service.checks]]`: `GET /api/health` at 15s interval, 2s timeout, 10s grace period
  - `[[vm]]`: `memory = '512mb'`, `cpu_kind = 'shared'`, `cpus = 1` (512 MB — larger than road-signs due to Python runtime)
- [ ] `deploy.sh` at repo root:
  - Guards: checks `flyctl` is installed and authenticated (`flyctl auth whoami`)
  - Creates the Fly app if it doesn't exist: `flyctl apps create prolifics-ai-catalog`
  - Creates the persistent volume if it doesn't exist: `flyctl volumes create catalog_data --region jnb --size 1 --yes`
  - Sets the `CATALOG_API_KEY` secret on the Fly app if `CATALOG_API_KEY` env var is set locally: `flyctl secrets set CATALOG_API_KEY="$CATALOG_API_KEY"`
  - Deploys: `flyctl deploy`
  - Prints the app URL on success
- [ ] `deploy.sh` is executable (`chmod +x`) and tested with `shellcheck`
- [ ] `README.md` at repo root includes a **Deploy** section with the three-step quickstart: install flyctl → set env vars → run `./deploy.sh`
- [ ] `CATALOG_API_KEY` is never committed — it is passed as a Fly secret; the README documents this explicitly

**Notes:**
- Reference: `road-signs-flashcards/deploy.sh` and `road-signs-flashcards/fly.toml` are the direct model for both files — follow the same guard/create/deploy structure
- `min_machines_running = 0` means the app cold-starts on first request; acceptable for an internal catalog that isn't under constant load
- Region `jnb` keeps latency low for the primary Prolifics audience in South Africa/UK; can be changed per deployment without changing the script
- The `CATALOG_API_KEY` secret must be set before any toolkit-workbench push will succeed; the deploy script handles this automatically if the env var is present at deploy time
