# Full Domain Model & UI Refinements

Extends the catalog to capture the complete AAF assembly structure — bindings, consumer-persona grants, persona-capabilities, agent flags, tool input schemas, and assembly dependencies — in a fully backwards-compatible way. The workbench extractor is updated in parallel so that each push supplies the richer data. Two new aggregation endpoints power a governance matrix and token cost pivot. UI refinements make all relationships navigable and filterable.

Five epics:
1. **Domain schema** — backwards-compatible Alembic migrations in `ai-catalog`
2. **Workbench extractor** — extract the missing data from YAML and push it in `toolkit-workbench`
3. **Catalog API** — extend existing endpoints and add aggregation queries
4. **Catalog UI — navigation** — enriched detail pages and cross-entity filtering
5. **Catalog UI — cross-cutting journeys** — governance matrix, impact trace, cost pivot, readiness checklist

---

## Epic: Domain Schema — Backwards-Compatible Migrations

Alembic migrations that add new tables and nullable columns only. No existing columns altered. Existing pushes continue to work — new fields are simply absent until a post-migration push fills them in.

---

### FDU-1: Add junction and relationship tables

**Type:** backend
**Status:** proposed
**Epic:** Domain Schema — Backwards-Compatible Migrations
**Repo:** `ai-catalog`

**As a** catalog API,
**I want** dedicated tables for BINDING, CONSUMER_PERSONA, PERSONA_CAPABILITY, ASSEMBLY_DEPENDENCY, and AGENT_TOOL,
**so that** every relationship in the domain model is queryable as a first-class join rather than being discarded at push time.

**Acceptance Criteria:**
- [ ] Alembic migration creates `binding` table: `id`, `assembly_id` (FK→assembly), `capability_name`, `description`, `agent_id` (FK→agent, nullable)
- [ ] Alembic migration creates `consumer_persona` table: `consumer_id` (FK→consumer), `persona_id` (FK→persona), composite PK
- [ ] Alembic migration creates `persona_capability` table: `persona_id` (FK→persona), `capability_name`, composite PK
- [ ] Alembic migration creates `assembly_dependency` table: `id`, `assembly_id` (FK→assembly), `name`, `url`, `required` (bool), `description`
- [ ] Alembic migration creates `agent_tool` table: `agent_id` (FK→agent), `tool_id` (FK→tool), composite PK
- [ ] All new tables use `IF NOT EXISTS`; running the migration twice is idempotent
- [ ] Existing catalog pushes (before workbench update) succeed with all new tables empty — no NOT NULL constraints that would break old push payloads

---

### FDU-2: Extend existing tables with new columns

**Type:** backend
**Status:** proposed
**Epic:** Domain Schema — Backwards-Compatible Migrations
**Repo:** `ai-catalog`

**As a** catalog API,
**I want** additional nullable columns on `agent`, `assembly`, and `tool`,
**so that** capability flags, assembly metadata, and tool schemas are persisted when a post-migration workbench push supplies them.

**Acceptance Criteria:**
- [ ] Alembic migration adds to `agent`: `orchestrator` (bool, nullable), `session_history` (bool, nullable), `guardrails` (bool, nullable), `observability` (bool, nullable), `max_tokens` (int, nullable)
- [ ] Alembic migration adds to `assembly`: `version` (string, nullable), `base_url` (string, nullable)
- [ ] `tool.input_schema` column already exists — confirm it is JSON type; write a corrective migration to change its type if it is currently stored as a string
- [ ] All new columns default to NULL; existing push payloads that omit them succeed without error

---

## Epic: Workbench Extractor — Push Full Domain Data

Updates `toolkit-workbench`'s `catalog.py` extractor to read and send the data the schema migrations above now accept. Extractor stories verify payload shape via unit tests — the round-trip through the catalog API is owned by FDU-7.

---

### FDU-3: Extract and push bindings

**Type:** backend
**Status:** proposed
**Epic:** Workbench Extractor — Push Full Domain Data
**Repo:** `toolkit-workbench`

**As a** workbench publisher,
**I want** each assembly's `bindings` block extracted from `assemblies.yaml` and included in the push payload,
**so that** the catalog can record which capability name maps to which agent within each assembly.

**Acceptance Criteria:**
- [ ] Extractor reads `assemblies[].bindings[]` from `assemblies.yaml`; each entry yields `capability_name`, `description`, `agent_id`
- [ ] Push payload includes `bindings: [{capability_name, description, agent_id}, ...]` per assembly (empty array if no bindings block)
- [ ] If `agent_id` in a binding does not resolve to a known agent, it is included in the payload as-is with a warning logged — not dropped silently, not a push failure
- [ ] An old catalog instance that does not recognise the `bindings` field ignores it gracefully — no 4xx/5xx
- [ ] Extractor unit test: fixture `assemblies.yaml` with two bindings produces a payload where `bindings` contains exactly two entries with the correct field values

---

### FDU-4: Extract consumer-persona grants and persona-capabilities

**Type:** backend
**Status:** proposed
**Epic:** Workbench Extractor — Push Full Domain Data
**Repo:** `toolkit-workbench`

**As a** workbench publisher,
**I want** `consumers[].personas[]` and `personas[].capabilities[]` extracted from `assemblies.yaml` and included in the push payload,
**so that** the catalog can answer "which personas can this consumer use?" and "which capabilities does this persona expose?".

**Acceptance Criteria:**
- [ ] Extractor reads `consumers[].personas[]` per assembly; push payload includes `consumer_persona_grants: [{consumer_id, persona_id}, ...]`
- [ ] Extractor reads `personas[].capabilities[]` per assembly; push payload includes `persona_capabilities: [{persona_id, capability_name}, ...]`
- [ ] If a `persona_id` in a consumer grant does not appear in the same assembly's personas block, it is included in the payload with a warning logged — not dropped silently
- [ ] An old catalog instance that does not recognise `consumer_persona_grants` or `persona_capabilities` ignores them gracefully
- [ ] Extractor unit test: fixture with one consumer granted two personas; each persona with two capabilities; payload contains two `consumer_persona_grants` entries and four `persona_capabilities` entries with correct field values

---

### FDU-5: Extract agent flags and tools list

**Type:** backend
**Status:** proposed
**Epic:** Workbench Extractor — Push Full Domain Data
**Repo:** `toolkit-workbench`

**As a** workbench publisher,
**I want** agent flags and the tools list read from `agents.yaml` and included in the push payload,
**so that** the catalog accurately reflects each agent's configuration and the tools it uses.

**Acceptance Criteria:**
- [ ] Extractor reads each agent's flags from `agents.yaml` by matching `agent_id`; payload includes `orchestrator`, `session_history`, `guardrails`, `observability`, `max_tokens` per agent
- [ ] Extractor reads `agents[].tools[]` from `agents.yaml`; payload includes `tools_used: [<tool_name>, ...]` per agent, replacing the current hardcoded `[]`
- [ ] If a tool name in `tools[]` does not resolve to a known tool, it is included by name in the payload with a warning logged — not dropped silently
- [ ] An old catalog instance that does not recognise agent flags or a non-empty `tools_used` ignores them gracefully
- [ ] Extractor unit test: fixture `agents.yaml` with one orchestrator agent using two named tools; payload for that agent shows `orchestrator: true` and `tools_used: ["tool-a", "tool-b"]`

---

### FDU-6: Extract assembly metadata and tool input schemas

**Type:** backend
**Status:** proposed
**Epic:** Workbench Extractor — Push Full Domain Data
**Repo:** `toolkit-workbench`

**As a** workbench publisher,
**I want** assembly `version`, `base_url`, and `dependencies` extracted from `assemblies.yaml`, and tool `input_schema` extracted from `tools.yaml`,
**so that** the catalog records the full deployment context for each assembly and the contract for each tool.

**Acceptance Criteria:**
- [ ] Extractor reads `assemblies[].version` (if present) and `assemblies[].a2a_hosting.base_url`; sends both in the assembly push payload
- [ ] Extractor reads `assemblies[].dependencies[]` (list of `{name, url, required, description}` objects, if present); sends in the push payload
- [ ] Extractor reads `input_schema` from each tool entry in `tools.yaml` and sends as a JSON object in the tool push payload
- [ ] An old catalog instance that does not recognise `version`, `base_url`, `dependencies`, or `input_schema` ignores them gracefully
- [ ] Extractor unit test: fixture assembly with `version: "1.2.0"`, one dependency, and one tool with a two-property `input_schema`; payload contains all three with correct values

---

## Epic: Catalog API — Serve Full Domain

Ensures all new tables and columns are populated on push, queryable via extended endpoints, and aggregated for the governance matrix and token pivot. Extractor payload shape is verified in FDU-3 through FDU-6; this epic owns the round-trip from push to response.

---

### FDU-7: Extend push and read endpoints with full domain data

**Type:** backend
**Status:** proposed
**Epic:** Catalog API — Serve Full Domain
**Repo:** `ai-catalog`

**As a** catalog UI,
**I want** push and read endpoints to accept and return the full domain data,
**so that** the UI can render every relationship without additional round-trips.

**Acceptance Criteria:**
- [ ] Push endpoint accepts and stores `bindings` per assembly; replaces previous binding rows for that assembly on each push
- [ ] Push endpoint accepts and stores `consumer_persona_grants` and `persona_capabilities`; replaces previous rows for the affected assembly on each push
- [ ] Push endpoint accepts agent flags and `tools_used` tool names, resolving them to `agent_tool` rows; replaces previous `agent_tool` rows on each push
- [ ] Push endpoint accepts and stores `version`, `base_url` on assembly; replaces `assembly_dependency` rows; stores `input_schema` on tools
- [ ] `GET /assemblies/{id}` response includes: `version`, `base_url`, `bindings` (each with `capability_name`, `description`, nested `agent` object), `dependencies`
- [ ] `GET /agents/{id}` response includes: `orchestrator`, `session_history`, `guardrails`, `observability`, `max_tokens`, `tools_used` (array of tool objects with `id`, `name`, `input_schema`)
- [ ] `GET /consumers/{id}` response includes: `personas` (array with `id`, `name`, `capabilities`)
- [ ] `GET /personas/{id}` response includes: `capabilities` (array of `{capability_name, binding}` where binding includes the nested agent when resolved)
- [ ] `GET /tools/{id}` returns `input_schema` as a parsed JSON object, not a raw string
- [ ] All new fields return empty arrays or null when not yet populated — no 500s on pre-migration data
- [ ] Existing list endpoints (`GET /assemblies`, `GET /agents`, etc.) are unchanged — no performance regression from new joins
- [ ] End-to-end integration test: push a fixture toolkit containing bindings, consumer-persona grants, agent flags, and tool input schemas; verify all fields returned correctly by the read endpoints above

---

### FDU-17: Aggregation endpoints for governance matrix and token pivot

**Type:** backend
**Status:** proposed
**Epic:** Catalog API — Serve Full Domain
**Repo:** `ai-catalog`

**As a** catalog UI,
**I want** dedicated aggregation endpoints for the consumer×capability access matrix and token spend grouped by persona or consumer,
**so that** the governance heat map (FDU-13) and token pivot (FDU-15) receive pre-computed results without performing complex joins client-side.

**Acceptance Criteria:**
- [ ] `GET /assemblies/{id}/access-matrix` returns `{ consumers: [{ id, name, capabilities: [{ capability_name, via_persona, agent_flags: { guardrails, observability } }] }] }` — one entry per consumer, listing every reachable capability and the flag status of its backing agent
- [ ] Capabilities where the backing agent has NULL flags include `flags_unknown: true` in their entry
- [ ] `GET /assemblies/{id}/token-stats?group_by=persona` returns stats rows grouped by persona, each with a nested capability breakdown
- [ ] `GET /assemblies/{id}/token-stats?group_by=consumer` returns stats rows grouped by consumer, each with nested persona and capability breakdown
- [ ] Both endpoints return `{ data: [], warning: "persona data not yet indexed — re-publish from workbench" }` when consumer-persona data is absent, rather than a 404 or 500
- [ ] Totals in the token pivot are consistent with the existing flat `GET /token-stats` totals — no double-counting

---

## Epic: Catalog UI — Full Domain Navigation

Surfaces the new relationships in the existing UI. Design principle: enrich detail pages first; add cross-entity filtering second.

---

### FDU-8: Consumer detail — personas and capability drill-down

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI — Full Domain Navigation
**Repo:** `ai-catalog`

**As a** catalog viewer,
**I want** to open a consumer and see which personas it is granted, with each persona's capabilities listed,
**so that** I can understand exactly what a given consumer application can do within an assembly.

**Acceptance Criteria:**
- [ ] Consumer detail page lists all granted personas with name and description
- [ ] Each persona entry is expandable to show its capability names
- [ ] Each capability name links to the binding detail (agent name, model, flags) within the same assembly
- [ ] When no consumer-persona data exists (pre-migration push), the page shows a "no persona data available — re-publish from workbench" placeholder
- [ ] Responsive: page is usable at tablet width

---

### FDU-9: Capability filter by consumer or persona

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI — Full Domain Navigation
**Repo:** `ai-catalog`

**As a** catalog viewer,
**I want** to filter the capabilities view by consumer or persona,
**so that** I can quickly find which agents are accessible from a given integration point.

**Acceptance Criteria:**
- [ ] Capabilities view gains a "Filter by consumer" dropdown populated from the consumers in the current assembly context
- [ ] Selecting a consumer narrows the list to capabilities reachable via that consumer's granted personas
- [ ] A secondary "Filter by persona" dropdown allows further narrowing within the selected consumer (or independently)
- [ ] Clearing a filter restores the unfiltered list
- [ ] Consumer and persona filters compose with the existing free-text search — all can be active simultaneously
- [ ] When `consumer_persona` data is absent, the dropdowns are hidden rather than shown empty

---

### FDU-10: Assembly detail — bindings, version, and dependencies

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI — Full Domain Navigation
**Repo:** `ai-catalog`

**As a** catalog viewer,
**I want** the assembly detail view to show its bindings (capability → agent), version, base URL, and dependencies,
**so that** I can understand the deployment shape of an assembly without reading the raw YAML.

**Acceptance Criteria:**
- [ ] Assembly detail shows `version` and `base_url` near the top (alongside or below the existing name/description)
- [ ] Bindings section lists each capability name with its mapped agent name, agent model, and `orchestrator` badge (if true)
- [ ] Dependencies section lists each dependency with name, URL (as a clickable link), required badge, and description
- [ ] Raw YAML collapsible section is retained unchanged
- [ ] Sections with no data (version not set, no dependencies) are omitted rather than shown as empty headers

---

### FDU-11: Agent detail — flags, tools, and input schema

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI — Full Domain Navigation
**Repo:** `ai-catalog`

**As a** catalog viewer,
**I want** the agent detail view to show capability flags and the list of tools the agent uses with their input schemas,
**so that** I can assess an agent's configuration and understand the contract of each tool it calls.

**Acceptance Criteria:**
- [ ] Agent detail shows a flag strip: `orchestrator`, `session_history`, `guardrails`, `observability` as badges (active = coloured, inactive = muted); `max_tokens` shown as a numeric value when set
- [ ] Tools used section lists each tool with name and description
- [ ] Each tool row is expandable to show `input_schema` rendered as a structured parameter table (name, type, required, description) rather than raw JSON
- [ ] When `tools_used` is empty or not yet populated, the section shows a "tools not yet indexed — re-publish from workbench" hint
- [ ] Agent flags that are NULL (pre-migration push) are shown as muted/unknown — not hidden entirely

---

## Epic: Catalog UI — Cross-Cutting Journeys

Higher-order views that synthesise data across multiple entities. Each journey answers a question that cannot be answered by looking at a single entity in isolation.

---

### FDU-12: Agent detail — impact trace

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI — Cross-Cutting Journeys
**Repo:** `ai-catalog`

**As a** developer or architect considering a change to an agent,
**I want** to see which personas expose this agent's capabilities and which consumers are granted those personas,
**so that** I can assess the blast radius of a change before making it.

**Acceptance Criteria:**
- [ ] Agent detail page includes an "Affected by changes" panel listing every binding that references this agent, grouped by assembly
- [ ] Each binding entry shows the capability name, the persona(s) that expose it, and the consumers granted those personas
- [ ] The chain is rendered as a readable path: `capability-name → persona-name → consumer-name`
- [ ] If the agent appears in multiple assemblies, each assembly is shown as a separate group
- [ ] When no binding data exists yet (pre-migration push), the panel shows a "publish from workbench to see impact data" placeholder
- [ ] Panel is collapsed by default; expands on click

---

### FDU-13: Governance heat map — consumer × capability matrix

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI — Cross-Cutting Journeys
**Repo:** `ai-catalog`

**Depends on:** FDU-17 (`GET /assemblies/{id}/access-matrix`)

**As a** platform architect or engineering lead,
**I want** a matrix view showing which consumers can reach which capabilities, with flag coverage visible,
**so that** I can spot governance gaps — capabilities accessible without guardrails, consumers with unexpectedly broad access — across the whole assembly at a glance.

**Acceptance Criteria:**
- [ ] Assembly detail (or dedicated governance tab) renders the matrix from `GET /assemblies/{id}/access-matrix`: consumers as rows, capability names as columns
- [ ] Each cell is filled when the consumer can reach that capability; empty otherwise
- [ ] Filled cells are coloured by agent flag status: green = guardrails + observability both true; amber = one missing; red = both missing; grey = `flags_unknown`
- [ ] Hovering a cell shows the resolve path: consumer → persona → capability → agent name
- [ ] An assembly picker allows switching between assemblies in the same toolkit
- [ ] When the API returns a `warning` (persona data absent), the view shows that message rather than an empty or broken matrix

---

### FDU-14: Capability search — flag filters

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI — Cross-Cutting Journeys
**Repo:** `ai-catalog`

**Depends on:** FDU-9 (extends the same filter bar)

**As a** developer evaluating capabilities across the portfolio,
**I want** to filter the capability list by agent flags in addition to consumer and persona,
**so that** I can find "all capabilities with guardrails enabled that the QA persona can access" without browsing every assembly manually.

**Acceptance Criteria:**
- [ ] The capability filter bar (introduced in FDU-9) gains three flag toggles: `orchestrator`, `guardrails`, `observability` — each tristate: any / true / false
- [ ] Flag filters compose with the consumer, persona, and text filters — all can be active simultaneously
- [ ] Result count updates reactively as filters change without a full page reload
- [ ] Each capability result shows its active flags as small inline badges
- [ ] A capability whose agent has NULL flags appears in "any" results but is excluded from true/false filtered results, with a "flags unknown" note in the result row
- [ ] Complete filter state (including flag values) is preserved in the URL so results can be bookmarked and shared

---

### FDU-15: Token spend — pivot by persona and consumer

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI — Cross-Cutting Journeys
**Repo:** `ai-catalog`

**Depends on:** FDU-17 (`GET /assemblies/{id}/token-stats?group_by=persona|consumer`)

**As a** product owner or engineering manager,
**I want** to see token cost and call volume broken down by persona and consumer,
**so that** I can understand which access channels are driving spend and have a conversation about cost attribution.

**Acceptance Criteria:**
- [ ] Token stats view gains a "by persona" pivot: each row is a persona; columns are total calls, total input tokens, total output tokens, total cost USD
- [ ] Expanding a persona row shows its constituent capabilities with their individual stats
- [ ] A "by consumer" pivot is available as a tab or toggle: each row is a consumer; expanding shows granted personas and their stats
- [ ] Pivot is scoped to the selected assembly; reuses the existing date-range filter if present
- [ ] When the API returns a warning (persona data absent), the view shows the warning message and falls back to the existing flat capability list
- [ ] Totals in the pivot match the existing flat token stats totals — no double-counting

---

### FDU-16: Assembly readiness checklist

**Type:** ux
**Status:** proposed
**Epic:** Catalog UI — Cross-Cutting Journeys
**Repo:** `ai-catalog`

**As a** platform engineer preparing an assembly for production,
**I want** a readiness checklist that scores the completeness of an assembly's catalog record,
**so that** I can see at a glance what is missing and know exactly what to fix in the workbench before go-live.

**Acceptance Criteria:**
- [ ] Assembly detail shows a readiness score (0–100%) derived from the checklist items below
- [ ] Checklist items:
  - All bindings resolve to a known agent (required — blocks green status)
  - `base_url` is set (required — blocks green status)
  - `version` is set (recommended)
  - All agents have `observability: true` (recommended)
  - All agents have `guardrails: true` (recommended)
  - All tools have `input_schema` populated (recommended)
- [ ] Each item is shown as pass / warn / fail with a one-line explanation and a link to the relevant detail section
- [ ] Score is shown as a coloured ring or progress bar: green ≥ 80%, amber 50–79%, red < 50%
- [ ] Any required item that fails caps the score at amber regardless of other items passing
