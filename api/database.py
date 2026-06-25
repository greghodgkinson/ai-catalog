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
            "ALTER TABLE toolkits ADD COLUMN publisher_name TEXT",
            "ALTER TABLE toolkits ADD COLUMN publisher_email TEXT",
            "ALTER TABLE toolkits ADD COLUMN owner_name TEXT",
            "ALTER TABLE toolkits ADD COLUMN owner_email TEXT",
            """CREATE TABLE IF NOT EXISTS toolkit_pushes (
                id              TEXT PRIMARY KEY,
                toolkit_id      TEXT NOT NULL REFERENCES toolkits(id) ON DELETE CASCADE,
                pushed_at       TEXT NOT NULL,
                pusher_name     TEXT,
                pusher_email    TEXT,
                git_branch      TEXT,
                git_last_commit TEXT
            )""",
        ]:
            try:
                await db.execute(sql)
            except Exception:
                pass  # column/table already exists
        await db.commit()
