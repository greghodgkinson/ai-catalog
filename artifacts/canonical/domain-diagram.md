# AI Catalog — Domain Diagram

The catalog stores published snapshots of AI toolkits. Each push replaces the structural data (assemblies, agents, tools) and accumulates usage statistics. Ownership and push attribution are tracked separately from the mutable toolkit record.

```mermaid
erDiagram

    TOOLKIT {
        int     id
        string  name
        string  description
        string  repo_url
        string  tags
        string  git_branch
        string  git_last_commit
        bool    git_is_dirty
        string  owner_name
        string  owner_email
        string  publisher_name
        string  publisher_email
        datetime first_published_at
        datetime last_published_at
    }

    ASSEMBLY {
        int     id
        int     toolkit_id
        string  name
        string  description
        string  base_url
        int     gateway_port
        text    raw_yaml
        datetime published_at
        string  version
    }

    ASSEMBLY_DEPENDENCY {
        int     id
        int     assembly_id
        string  name
        string  url
        bool    required
        string  description
    }

    CONSUMER {
        int     id
        int     assembly_id
        int     toolkit_id
        string  name
        string  description
    }

    PERSONA {
        int     id
        int     assembly_id
        int     toolkit_id
        string  name
        string  description
        int     capability_count
    }

    CONSUMER_PERSONA {
        int     consumer_id
        int     persona_id
    }

    PERSONA_CAPABILITY {
        int     persona_id
        string  capability_name
    }

    BINDING {
        int     id
        int     assembly_id
        string  capability_name
        string  description
        int     agent_id
    }

    AGENT {
        int     id
        int     toolkit_id
        string  name
        string  description
        string  model
        string  llm_class
        bool    orchestrator
        bool    session_history
        bool    guardrails
        bool    observability
        int     max_tokens
    }

    TOOL {
        int     id
        int     toolkit_id
        string  name
        string  description
        json    input_schema
        string  output_description
    }

    AGENT_TOOL {
        int     agent_id
        int     tool_id
    }

    TOKEN_STATS {
        int     id
        int     toolkit_id
        string  capability_name
        string  capability_type
        string  provider
        int     call_count
        real    total_input_tokens
        real    total_output_tokens
        real    avg_input_tokens
        real    avg_output_tokens
        real    total_cost_usd
        real    avg_cost_usd
        real    total_duration_ms
        real    avg_duration_ms
        datetime last_updated_at
    }

    TOOLKIT_PUSH {
        int     id
        int     toolkit_id
        datetime pushed_at
        string  pusher_name
        string  pusher_email
        string  git_branch
        string  git_last_commit
    }

    TOOLKIT            ||--o{ ASSEMBLY          : "contains"
    TOOLKIT            ||--o{ AGENT             : "contains"
    TOOLKIT            ||--o{ TOOL              : "contains"
    TOOLKIT            ||--o{ TOKEN_STATS       : "accumulates"
    TOOLKIT            ||--o{ TOOLKIT_PUSH      : "history"
    ASSEMBLY           ||--o{ CONSUMER          : "exposes to"
    ASSEMBLY           ||--o{ PERSONA           : "offers"
    ASSEMBLY           ||--o{ BINDING           : "exposes"
    ASSEMBLY           ||--o{ ASSEMBLY_DEPENDENCY : "depends on"
    CONSUMER           }o--o{ PERSONA           : "granted via CONSUMER_PERSONA"
    PERSONA            ||--o{ PERSONA_CAPABILITY : "exposes"
    PERSONA_CAPABILITY }o--|| BINDING           : "resolves to"
    BINDING            }o--|| AGENT             : "served by"
    AGENT              }o--o{ TOOL              : "uses via AGENT_TOOL"
```

---

## Implementation status

| Entity / relationship | In DB schema | Extractor populates |
|---|---|---|
| TOOLKIT | ✓ | ✓ |
| ASSEMBLY | ✓ (no `version`, no `base_url`) | ✓ (port lookup broken for ref-impl pattern) |
| ASSEMBLY_DEPENDENCY | ✗ | ✗ |
| BINDING | ✗ | ✗ (data is in YAML `bindings[].{capability_name, description, agent_id}`) |
| CONSUMER | ✓ | ✓ |
| PERSONA | ✓ (count only, no capability names) | ✓ (count only) |
| CONSUMER_PERSONA | ✗ | ✗ (data is in YAML `consumers[].personas[]`) |
| PERSONA_CAPABILITY | ✗ | ✗ (data is in YAML `personas[].capabilities[]`) |
| AGENT | ✓ (missing `orchestrator`, `session_history`, `guardrails`, `observability`, `max_tokens`) | ✓ (description from binding, not agents.yaml) |
| TOOL | ✓ (`input_schema` column exists but always NULL) | ✓ (input_schema never read) |
| AGENT_TOOL | column `tools_used` exists as JSON on AGENT | ✗ (extractor always sends `[]`) |
| TOKEN_STATS | ✓ | ✓ |
| TOOLKIT_PUSH | ✓ | ✓ |

---

## Key design decisions

| Decision | Rationale |
|---|---|
| Assembly/agent/tools replaced on each push | Latest snapshot always wins; structural drift is corrected automatically |
| `token_stats` accumulated, never replaced | Call counts and costs grow monotonically; each developer's pushes contribute additive increments |
| `TOOLKIT_PUSH` is append-only | Full contributor history retained regardless of toolkit structural changes |
| Ownership separate from publisher | First pusher becomes owner; subsequent pushers update `publisher_*` only, not `owner_*` (unless `claim_ownership: true`) |
| `AGENT → TOOL` is a name reference, not a FK | `tools_used` is a JSON array of names; tools are resolved at read time within the same toolkit |
| Tags stored as comma-separated string | No separate tag table in v1 — acceptable for the current scale |
