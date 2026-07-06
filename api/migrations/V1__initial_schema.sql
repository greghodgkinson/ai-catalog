PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS toolkits (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL UNIQUE,
    description      TEXT,
    repo_url         TEXT,
    owner            TEXT,
    tags             TEXT,
    git_branch       TEXT,
    git_last_commit  TEXT,
    git_is_dirty     INTEGER NOT NULL DEFAULT 0,
    first_published_at TEXT NOT NULL,
    last_published_at  TEXT NOT NULL,
    publisher_name   TEXT,
    publisher_email  TEXT,
    owner_name       TEXT,
    owner_email      TEXT
);

CREATE TABLE IF NOT EXISTS assemblies (
    id           TEXT PRIMARY KEY,
    toolkit_id   TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    gateway_port INTEGER,
    raw_yaml     TEXT,
    published_at TEXT NOT NULL,
    version      TEXT,
    base_url     TEXT
);

CREATE TABLE IF NOT EXISTS consumers (
    id          TEXT PRIMARY KEY,
    assembly_id TEXT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    toolkit_id  TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS personas (
    id               TEXT PRIMARY KEY,
    assembly_id      TEXT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    toolkit_id       TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    description      TEXT,
    capability_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agents (
    id             TEXT PRIMARY KEY,
    toolkit_id     TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    description    TEXT,
    tools_used     TEXT,
    llm_class      TEXT,
    model          TEXT,
    orchestrator   INTEGER,
    session_history INTEGER,
    guardrails     INTEGER,
    observability  INTEGER,
    max_tokens     INTEGER
);

CREATE TABLE IF NOT EXISTS tools (
    id                 TEXT PRIMARY KEY,
    toolkit_id         TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
    name               TEXT NOT NULL,
    description        TEXT,
    input_schema       TEXT,
    output_description TEXT
);

CREATE TABLE IF NOT EXISTS toolkit_pushes (
    id              TEXT PRIMARY KEY,
    toolkit_id      TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
    pushed_at       TEXT NOT NULL,
    pusher_name     TEXT,
    pusher_email    TEXT,
    git_branch      TEXT,
    git_last_commit TEXT
);

CREATE TABLE IF NOT EXISTS bindings (
    id              TEXT PRIMARY KEY,
    assembly_id     TEXT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    capability_name TEXT NOT NULL,
    description     TEXT,
    agent_name      TEXT
);

CREATE TABLE IF NOT EXISTS consumer_persona (
    consumer_id TEXT NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
    persona_id  TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    PRIMARY KEY (consumer_id, persona_id)
);

CREATE TABLE IF NOT EXISTS persona_capability (
    persona_id      TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    capability_name TEXT NOT NULL,
    PRIMARY KEY (persona_id, capability_name)
);

CREATE TABLE IF NOT EXISTS assembly_dependency (
    id          TEXT PRIMARY KEY,
    assembly_id TEXT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    url         TEXT,
    required    INTEGER NOT NULL DEFAULT 0,
    description TEXT
);

CREATE TABLE IF NOT EXISTS agent_tool (
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tool_id  TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, tool_id)
);

-- token_stats rows are never replaced on re-push — they accumulate via CAT-3
CREATE TABLE IF NOT EXISTS token_stats (
    id                  TEXT PRIMARY KEY,
    toolkit_id          TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
    capability_name     TEXT NOT NULL,
    call_count          INTEGER NOT NULL DEFAULT 0,
    total_input_tokens  INTEGER NOT NULL DEFAULT 0,
    total_output_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost_usd      REAL    NOT NULL DEFAULT 0,
    avg_input_tokens    REAL,
    avg_output_tokens   REAL,
    avg_cost_usd        REAL,
    total_duration_ms   REAL    NOT NULL DEFAULT 0,
    avg_duration_ms     REAL,
    provider            TEXT,
    capability_type     TEXT,
    last_updated_at     TEXT NOT NULL,
    UNIQUE(toolkit_id, capability_name)
);
