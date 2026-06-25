import json

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from database import get_db

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _q(q: str | None) -> tuple[str, list]:
    """Return a WHERE clause and params for optional name+description search."""
    if q:
        like = f"%{q}%"
        return "WHERE (name LIKE ? OR description LIKE ?)", [like, like]
    return "", []


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(db: aiosqlite.Connection = Depends(get_db)):
    async def _count(table: str) -> int:
        async with db.execute(f"SELECT COUNT(*) FROM {table}") as cur:
            return (await cur.fetchone())[0]

    async with db.execute(
        "SELECT COALESCE(SUM(call_count),0), COALESCE(SUM(total_cost_usd),0) FROM token_stats"
    ) as cur:
        ts = await cur.fetchone()

    return {
        "toolkits":       await _count("toolkits"),
        "assemblies":     await _count("assemblies"),
        "consumers":      await _count("consumers"),
        "personas":       await _count("personas"),
        "agents":         await _count("agents"),
        "tools":          await _count("tools"),
        "total_calls":    ts[0],
        "total_cost_usd": round(ts[1], 6),
    }


# ── Toolkits ──────────────────────────────────────────────────────────────────

@router.get("/toolkits")
async def list_toolkits(q: str | None = None, db: aiosqlite.Connection = Depends(get_db)):
    clause, params = _q(q)
    sql = f"""
        SELECT t.*,
            (SELECT COUNT(*) FROM agents  a WHERE a.toolkit_id = t.id) AS agent_count,
            (SELECT COUNT(*) FROM tools   tl WHERE tl.toolkit_id = t.id) AS tool_count,
            (SELECT COUNT(*) FROM consumers c WHERE c.toolkit_id = t.id) AS consumer_count,
            (SELECT COUNT(*) FROM personas  p WHERE p.toolkit_id = t.id) AS persona_count,
            (SELECT COALESCE(SUM(call_count),0) FROM token_stats ts WHERE ts.toolkit_id = t.id) AS total_calls
        FROM toolkits t {clause} ORDER BY t.last_published_at DESC
    """
    async with db.execute(sql, params) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/toolkits/{tid}/spec")
async def get_toolkit_spec(tid: str, db: aiosqlite.Connection = Depends(get_db)):
    """Return raw YAML for the toolkit's assemblies as a downloadable file."""
    async with db.execute(
        "SELECT t.name, a.raw_yaml FROM assemblies a JOIN toolkits t ON t.id=a.toolkit_id WHERE a.toolkit_id=? LIMIT 1",
        (tid,),
    ) as cur:
        row = await cur.fetchone()
    if not row or not row["raw_yaml"]:
        raise HTTPException(404, "No spec available for this toolkit")
    filename = row["name"].replace(" ", "-").lower() + "-spec.yaml"
    return PlainTextResponse(
        row["raw_yaml"],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/toolkits/{tid}/pushes")
async def get_toolkit_pushes(
    tid: str,
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute("SELECT id FROM toolkits WHERE id=?", (tid,)) as cur:
        if not await cur.fetchone():
            raise HTTPException(404, "Toolkit not found")
    async with db.execute(
        "SELECT COUNT(*) FROM toolkit_pushes WHERE toolkit_id=?", (tid,)
    ) as cur:
        total = (await cur.fetchone())[0]
    async with db.execute(
        "SELECT * FROM toolkit_pushes WHERE toolkit_id=? ORDER BY pushed_at DESC LIMIT ?",
        (tid, limit),
    ) as cur:
        rows = await cur.fetchall()
    return {"pushes": [dict(r) for r in rows], "total": total}


@router.get("/toolkits/{tid}/token-stats")
async def get_token_stats(tid: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT id FROM toolkits WHERE id=?", (tid,)) as cur:
        if not await cur.fetchone():
            raise HTTPException(404, "Toolkit not found")
    async with db.execute(
        "SELECT * FROM token_stats WHERE toolkit_id=? ORDER BY call_count DESC", (tid,)
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/toolkits/{tid}")
async def get_toolkit(tid: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM toolkits WHERE id=?", (tid,)) as cur:
        toolkit = await cur.fetchone()
    if not toolkit:
        raise HTTPException(404, "Toolkit not found")

    async with db.execute(
        "SELECT * FROM assemblies WHERE toolkit_id=? ORDER BY name", (tid,)
    ) as cur:
        assemblies = await cur.fetchall()

    asm_list = []
    for a in assemblies:
        aid = a["id"]
        async with db.execute("SELECT * FROM consumers WHERE assembly_id=?", (aid,)) as cur:
            consumers = await cur.fetchall()
        async with db.execute("SELECT * FROM personas WHERE assembly_id=?", (aid,)) as cur:
            personas = await cur.fetchall()
        asm_list.append({
            **dict(a),
            "consumers": [dict(c) for c in consumers],
            "personas":  [dict(p) for p in personas],
        })

    async with db.execute("SELECT * FROM agents WHERE toolkit_id=? ORDER BY name", (tid,)) as cur:
        agents = await cur.fetchall()
    async with db.execute("SELECT * FROM tools WHERE toolkit_id=? ORDER BY name", (tid,)) as cur:
        tools = await cur.fetchall()
    async with db.execute(
        "SELECT * FROM token_stats WHERE toolkit_id=? ORDER BY call_count DESC", (tid,)
    ) as cur:
        stats = await cur.fetchall()

    tool_list = []
    for t in tools:
        td = dict(t)
        if td.get("input_schema"):
            try:
                td["input_schema"] = json.loads(td["input_schema"])
            except Exception:
                pass
        tool_list.append(td)

    return {
        **dict(toolkit),
        "assemblies":  asm_list,
        "agents":      [dict(a) for a in agents],
        "tools":       tool_list,
        "token_stats": [dict(s) for s in stats],
    }


# ── Browse views ──────────────────────────────────────────────────────────────

@router.get("/consumers")
async def list_consumers(q: str | None = None, toolkit_id: str | None = None, db: aiosqlite.Connection = Depends(get_db)):
    wheres, params = [], []
    if q:
        wheres.append("(c.name LIKE ? OR c.description LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    if toolkit_id:
        wheres.append("c.toolkit_id = ?")
        params.append(toolkit_id)
    clause = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    async with db.execute(
        f"SELECT c.*, t.name AS toolkit_name FROM consumers c "
        f"JOIN toolkits t ON t.id=c.toolkit_id {clause} ORDER BY c.name",
        params,
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/personas")
async def list_personas(q: str | None = None, toolkit_id: str | None = None, db: aiosqlite.Connection = Depends(get_db)):
    wheres, params = [], []
    if q:
        wheres.append("(p.name LIKE ? OR p.description LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    if toolkit_id:
        wheres.append("p.toolkit_id = ?")
        params.append(toolkit_id)
    clause = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    async with db.execute(
        f"SELECT p.*, t.name AS toolkit_name FROM personas p "
        f"JOIN toolkits t ON t.id=p.toolkit_id {clause} ORDER BY p.name",
        params,
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/agents")
async def list_agents(q: str | None = None, toolkit_id: str | None = None, db: aiosqlite.Connection = Depends(get_db)):
    wheres, params = [], []
    if q:
        wheres.append("(a.name LIKE ? OR a.description LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    if toolkit_id:
        wheres.append("a.toolkit_id = ?")
        params.append(toolkit_id)
    clause = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    async with db.execute(
        f"SELECT a.*, t.name AS toolkit_name FROM agents a "
        f"JOIN toolkits t ON t.id=a.toolkit_id {clause} ORDER BY a.name",
        params,
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/tools")
async def list_tools(q: str | None = None, toolkit_id: str | None = None, db: aiosqlite.Connection = Depends(get_db)):
    wheres, params = [], []
    if q:
        wheres.append("(tl.name LIKE ? OR tl.description LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    if toolkit_id:
        wheres.append("tl.toolkit_id = ?")
        params.append(toolkit_id)
    clause = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    async with db.execute(
        f"SELECT tl.*, tk.name AS toolkit_name FROM tools tl "
        f"JOIN toolkits tk ON tk.id=tl.toolkit_id {clause} ORDER BY tl.name",
        params,
    ) as cur:
        rows = await cur.fetchall()
    result = []
    for row in rows:
        rd = dict(row)
        if rd.get("input_schema"):
            try:
                rd["input_schema"] = json.loads(rd["input_schema"])
            except Exception:
                pass
        result.append(rd)
    return result
