import os
import aiosqlite

DATA_DIR = os.environ.get("DATA_DIR", os.path.expanduser("~/.ai-catalog"))
DB_PATH = os.path.join(DATA_DIR, "catalog.db")

_MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "migrations")


async def get_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys=ON")
        yield db


async def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    schema_path = os.path.join(_MIGRATIONS_DIR, "V1__initial_schema.sql")
    with open(schema_path, encoding="utf-8") as f:
        schema = f.read()
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.executescript(schema)
        for sql in [
            "ALTER TABLE token_stats ADD COLUMN total_duration_ms REAL NOT NULL DEFAULT 0",
            "ALTER TABLE token_stats ADD COLUMN avg_duration_ms REAL",
            "ALTER TABLE token_stats ADD COLUMN capability_type TEXT",
            "ALTER TABLE toolkits ADD COLUMN publisher_name TEXT",
            "ALTER TABLE toolkits ADD COLUMN publisher_email TEXT",
            "ALTER TABLE toolkits ADD COLUMN owner_name TEXT",
            "ALTER TABLE toolkits ADD COLUMN owner_email TEXT",
            # SQLite cannot add a column with a UNIQUE constraint via ALTER TABLE.
            # Add it first, then create the equivalent unique index separately so
            # existing catalog volumes are migrated as well as fresh databases.
            "ALTER TABLE toolkits ADD COLUMN source_url TEXT",
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_toolkits_source_url ON toolkits(source_url)",
            "ALTER TABLE assemblies ADD COLUMN version TEXT",
            "ALTER TABLE assemblies ADD COLUMN base_url TEXT",
            "ALTER TABLE agents ADD COLUMN orchestrator INTEGER",
            "ALTER TABLE agents ADD COLUMN session_history INTEGER",
            "ALTER TABLE agents ADD COLUMN guardrails INTEGER",
            "ALTER TABLE agents ADD COLUMN observability INTEGER",
            "ALTER TABLE agents ADD COLUMN max_tokens INTEGER",
            """CREATE TABLE IF NOT EXISTS toolkit_pushes (
                id              TEXT PRIMARY KEY,
                toolkit_id      TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
                pushed_at       TEXT NOT NULL,
                pusher_name     TEXT,
                pusher_email    TEXT,
                git_branch      TEXT,
                git_last_commit TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS bindings (
                id              TEXT PRIMARY KEY,
                assembly_id     TEXT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
                capability_name TEXT NOT NULL,
                description     TEXT,
                agent_name      TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS consumer_persona (
                consumer_id TEXT NOT NULL REFERENCES consumers(id) ON DELETE CASCADE,
                persona_id  TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
                PRIMARY KEY (consumer_id, persona_id)
            )""",
            """CREATE TABLE IF NOT EXISTS persona_capability (
                persona_id      TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
                capability_name TEXT NOT NULL,
                PRIMARY KEY (persona_id, capability_name)
            )""",
            """CREATE TABLE IF NOT EXISTS assembly_dependency (
                id          TEXT PRIMARY KEY,
                assembly_id TEXT NOT NULL REFERENCES assemblies(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                url         TEXT,
                required    INTEGER NOT NULL DEFAULT 0,
                description TEXT
            )""",
            """CREATE TABLE IF NOT EXISTS agent_tool (
                agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
                tool_id  TEXT NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
                PRIMARY KEY (agent_id, tool_id)
            )""",
        ]:
            try:
                await db.execute(sql)
            except Exception:
                pass  # column/table already exists
        await db.commit()
