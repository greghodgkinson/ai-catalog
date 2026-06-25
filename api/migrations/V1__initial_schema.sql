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
    published_at TEXT NOT NULL
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
    id          TEXT PRIMARY KEY,
    toolkit_id  TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    tools_used  TEXT,
    llm_class   TEXT,
    model       TEXT
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
