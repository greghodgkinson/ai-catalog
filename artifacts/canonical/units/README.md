# Units

Each file in this directory represents one unit of catalog work. A unit maps to a bounded problem area and contains one or more epics and their stories.

## Naming convention

```
YYYY-MM-DD-NNN-short-name.md
```

- `YYYY-MM-DD` — date the unit was created
- `NNN` — three-digit sequence number within that date (001, 002, …)
- `short-name` — kebab-case description of the unit

Example: `2026-06-24-001-catalog-ingestion.md`

---

## Unit file template

```markdown
# [Unit title]

[One or two sentences describing the scope and goal of this unit.]

---

## Epic: [Epic name]

[Optional: one paragraph describing the epic and its motivation.]

---

### [ABBREV-N]: [Story title]

**Type:** agent | tool | ux | backend | reference
**Status:** proposed | in-progress | done
**Epic:** [Epic name]
**Repo:** `ai-catalog`

**As a** [role],
**I want** [capability],
**so that** [benefit].

**Acceptance Criteria:**
- [ ] ...
- [ ] ...

**Notes:**
- [Any technical context, constraints, or open questions]

---
```
