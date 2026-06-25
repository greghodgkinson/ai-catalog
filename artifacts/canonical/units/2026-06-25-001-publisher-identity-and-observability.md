# Publisher Identity, Toolkit Ownership & Observability

Ensures every toolkit push is attributed to a real person, establishes an ownership model with a full push-contributor history, and confirms that token cost and average response time are tracked end-to-end from workbench to catalog UI.

---

## Epic: Publisher Identity Gate

Every toolkit push must carry the name and email of the person who pushed it. The workbench reads this from git config by default and blocks the Publish button until it is known.

---

### CAT-1: Workbench — read git identity for push attribution

**Type:** backend
**Status:** proposed
**Epic:** Publisher Identity Gate
**Repo:** `toolkit-workbench`

**As a** platform engineer,
**I want** the workbench to read `git config user.name` and `git config user.email` from the toolkit repo path,
**so that** every push payload automatically carries the pusher's identity without manual entry.

**Acceptance Criteria:**
- [ ] `_extract_git_info` in `api/routers/catalog.py` runs `git config user.name` and `git config user.email` against the toolkit path
- [ ] Returns `publisher_name: str | None` and `publisher_email: str | None` in its dict
- [ ] `extract_toolkit_snapshot` includes these two fields in the snapshot payload sent to the catalog

**Notes:**
- Same helper `_run_git` pattern used for branch/commit — just add two more calls
- If git config is unset the values will be `None`; the UI gate (CAT-2) handles that case

---

### CAT-2: Workbench UI — show publisher identity, allow override, gate Publish button

**Type:** ux
**Status:** proposed
**Epic:** Publisher Identity Gate
**Repo:** `toolkit-workbench`

**As a** toolkit author,
**I want** to see my publisher name and email in the CatalogTab before I push, be able to edit them, and be prevented from pushing if they are blank,
**so that** every entry in the catalog is traceable to a real person.

**Acceptance Criteria:**
- [ ] CatalogTab shows a "Publisher" section with editable name and email fields, pre-populated from the git-derived values
- [ ] Publish button is disabled and shows a tooltip ("Publisher name and email are required") when either field is empty
- [ ] If the git-derived values are non-empty the fields are pre-filled and the user can proceed immediately without touching them
- [ ] The values from these fields are sent in the push payload as `publisher_name` and `publisher_email`
- [ ] State is not persisted across sessions — fields re-populate from git config each time the tab loads

---

### CAT-3: Catalog API — accept and store publisher identity on push

**Type:** backend
**Status:** proposed
**Epic:** Publisher Identity Gate
**Repo:** `ai-catalog`

**As a** catalog administrator,
**I want** the push endpoint to accept and persist `publisher_name` and `publisher_email`,
**so that** every toolkit entry records who most recently published it.

**Acceptance Criteria:**
- [ ] `ToolkitSnapshot` model gains `publisher_name: str | None` and `publisher_email: str | None`
- [ ] `toolkits` table gains `publisher_name TEXT` and `publisher_email TEXT` columns (migration)
- [ ] On upsert, `publisher_name` and `publisher_email` are written alongside `last_published_at`
- [ ] `GET /toolkits` and `GET /toolkits/{id}` responses include `publisher_name` and `publisher_email`
- [ ] Catalog toolkit detail UI shows "Last published by: Name \<email\>" beneath the last-published timestamp

---

## Epic: Toolkit Ownership & Push History

The catalog tracks who owns each toolkit (first pusher by default, updatable) and maintains a full log of every push so contributors are visible.

---

### CAT-4: Catalog — toolkit ownership

**Type:** backend
**Status:** proposed
**Epic:** Toolkit Ownership & Push History
**Repo:** `ai-catalog`

**As a** catalog consumer,
**I want** each toolkit to have a named owner,
**so that** I know who to contact about it.

**Acceptance Criteria:**
- [ ] `toolkits` table gains `owner_name TEXT` and `owner_email TEXT` columns (migration)
- [ ] On first push (INSERT), `owner_name` and `owner_email` are set from `publisher_name` / `publisher_email`
- [ ] On subsequent pushes (UPDATE), `owner_name` and `owner_email` are only overwritten if the push payload includes an explicit `claim_ownership: true` flag
- [ ] `GET /toolkits` and `GET /toolkits/{id}` return `owner_name` and `owner_email`
- [ ] Workbench CatalogTab shows current owner (read from a `GET /toolkits?name=` lookup) and provides a "Claim ownership" checkbox that sets `claim_ownership: true` in the next push

**Notes:**
- `claim_ownership` is a boolean field in `ToolkitSnapshot`; defaults to `false`
- Existing toolkits with no owner record their next pusher as owner automatically

---

### CAT-5: Catalog — push history table

**Type:** backend
**Status:** proposed
**Epic:** Toolkit Ownership & Push History
**Repo:** `ai-catalog`

**As a** catalog administrator,
**I want** every push to be recorded with its pusher's details and timestamp,
**so that** I can see a full history of who has contributed updates to each toolkit.

**Acceptance Criteria:**
- [ ] New table `toolkit_pushes (id, toolkit_id, pushed_at, pusher_name, pusher_email, git_branch, git_last_commit)` created via migration
- [ ] Push endpoint inserts one row into `toolkit_pushes` on every successful push (both INSERT and UPDATE paths)
- [ ] `GET /toolkits/{id}/pushes` returns the push history newest-first, paginated (default limit 50)
- [ ] Response shape: `{ pushes: [{ id, pushed_at, pusher_name, pusher_email, git_branch, git_last_commit }], total: N }`

---

### CAT-6: Catalog UI — owner and contributors panel

**Type:** ux
**Status:** proposed
**Epic:** Toolkit Ownership & Push History
**Repo:** `ai-catalog`

**As a** catalog consumer,
**I want** to see the toolkit owner and a list of recent contributors in the toolkit detail page,
**so that** I understand who maintains it and who has been actively working on it.

**Acceptance Criteria:**
- [ ] Toolkit detail page shows an "Owner" row: `owner_name <owner_email>` (or "—" if unset)
- [ ] Toolkit detail page shows a "Contributors" section listing unique pushers from `toolkit_pushes`, sorted by most-recent push first
- [ ] Each contributor entry shows: name, email, and date of their most recent push
- [ ] If only one person has ever pushed, the contributors list is omitted and "Owner" row is sufficient
- [ ] Toolkit list/card view shows owner name in a small secondary line beneath the description

---

## Epic: Token Stats & Round-Trip Time Observability

Token cost data and average LLM response time should flow from the workbench into the catalog and be visible on the toolkit detail page.

---

### CAT-7: Deploy uncommitted round-trip time changes

**Type:** backend
**Status:** proposed
**Epic:** Token Stats & Round-Trip Time Observability
**Repo:** `ai-catalog`

**As a** catalog user,
**I want** average LLM response time to be stored and shown in the catalog,
**so that** I can compare performance across toolkit capabilities.

**Acceptance Criteria:**
- [ ] Uncommitted changes to `api/database.py`, `api/migrations/V1__initial_schema.sql`, `api/routers/push.py`, `ui/src/lib/api.ts`, and `ui/src/pages/ToolkitDetail.tsx` are reviewed, committed, and pushed
- [ ] `V1__initial_schema.sql` includes `total_duration_ms REAL NOT NULL DEFAULT 0` and `avg_duration_ms REAL` on `token_stats` table
- [ ] Push endpoint accumulates `total_duration_ms` and recomputes `avg_duration_ms` on each upsert
- [ ] `ToolkitDetail` page shows "Avg Response" column in the token stats table, formatted as `Xs` or `Xm` as appropriate
- [ ] Deployed to Fly.io (`fly deploy` from `ai-catalog/`) and verified live at https://ai-catalog-mhmhiq.fly.dev

**Notes:**
- The workbench already computes `total_duration_ms` via `(julianday(finished_at) - julianday(started_at)) * 86400000.0` in `collect_token_stats`
- Only missing piece is deployment

---

### CAT-8: Verify and document token stats end-to-end flow

**Type:** reference
**Status:** proposed
**Epic:** Token Stats & Round-Trip Time Observability
**Repo:** `ai-catalog`

**As a** toolkit maintainer,
**I want** to know exactly which fields are tracked and how they get from the workbench into the catalog,
**so that** I can confidently re-push toolkits to see their stats.

**Acceptance Criteria:**
- [ ] After deploying CAT-7, re-push at least one toolkit (e.g. AI SDLC Toolkit) with "Include token stats" checked
- [ ] Catalog UI shows populated `call_count`, `total_input_tokens`, `total_output_tokens`, `total_cost_usd`, and `avg_duration_ms` for at least one capability
- [ ] The six tracked fields are documented in a comment in `toolkit-workbench/api/routers/catalog.py` above `collect_token_stats`

---
