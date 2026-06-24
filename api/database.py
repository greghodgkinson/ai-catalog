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
        await db.commit()
