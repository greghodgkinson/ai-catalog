import json

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse

from database import get_db

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _q(q: str | None) -> tuple[str, list]:
    if q:
        like = f"%{q}%"
        return "WHERE (name LIKE ? OR description LIKE ?)", [like, like]
    return "", []


def _parse_bool(v) -> bool | None:
    if v is None:
        return None
    return bool(v)


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
async def get_toolkit_pushes(tid: str, limit: int = 50, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT id FROM toolkits WHERE id=?", (tid,)) as cur:
        if not await cur.fetchone():
            raise HTTPException(404, "Toolkit not found")
    async with db.execute("SELECT COUNT(*) FROM toolkit_pushes WHERE toolkit_id=?", (tid,)) as cur:
        total = (await cur.fetchone())[0]
    async with db.execute(
        "SELECT * FROM toolkit_pushes WHERE toolkit_id=? ORDER BY pushed_at DESC LIMIT ?",
        (tid, limit),
    ) as cur:
        rows = await cur.fetchall()
    return {"pushes": [dict(r) for r in rows], "total": total}


@router.get("/toolkits/{tid}/token-stats")
async def get_token_stats(
    tid: str,
    group_by: str | None = Query(default=None),
    db: aiosqlite.Connection = Depends(get_db),
):
    async with db.execute("SELECT id FROM toolkits WHERE id=?", (tid,)) as cur:
        if not await cur.fetchone():
            raise HTTPException(404, "Toolkit not found")

    if group_by not in ("persona", "consumer", None):
        raise HTTPException(400, "group_by must be 'persona' or 'consumer'")

    if group_by is None:
        async with db.execute(
            "SELECT * FROM token_stats WHERE toolkit_id=? ORDER BY call_count DESC", (tid,)
        ) as cur:
            rows = await cur.fetchall()
        return [dict(r) for r in rows]

    # Check if persona data exists
    async with db.execute(
        "SELECT COUNT(*) FROM persona_capability pc "
        "JOIN personas p ON p.id=pc.persona_id WHERE p.toolkit_id=?", (tid,)
    ) as cur:
        pc_count = (await cur.fetchone())[0]

    if pc_count == 0:
        async with db.execute(
            "SELECT * FROM token_stats WHERE toolkit_id=? ORDER BY call_count DESC", (tid,)
        ) as cur:
            rows = await cur.fetchall()
        return {
            "data": [],
            "warning": "Persona data not yet indexed — re-publish from workbench",
            "flat_fallback": [dict(r) for r in rows],
        }

    if group_by == "persona":
        async with db.execute(
            """SELECT p.id AS persona_id, p.name AS persona_name,
                      ts.capability_name, ts.call_count,
                      ts.total_input_tokens, ts.total_output_tokens,
                      ts.total_cost_usd, ts.avg_cost_usd, ts.avg_duration_ms,
                      ts.provider, ts.capability_type
               FROM token_stats ts
               JOIN persona_capability pc ON pc.capability_name = ts.capability_name
               JOIN personas p ON p.id = pc.persona_id
               WHERE ts.toolkit_id = ? AND p.toolkit_id = ?
               ORDER BY p.name, ts.call_count DESC""",
            (tid, tid),
        ) as cur:
            rows = await cur.fetchall()

        grouped: dict[str, dict] = {}
        for r in rows:
            pid = r["persona_id"]
            if pid not in grouped:
                grouped[pid] = {
                    "persona_id": pid,
                    "persona_name": r["persona_name"],
                    "total_calls": 0,
                    "total_cost_usd": 0.0,
                    "capabilities": [],
                }
            grouped[pid]["total_calls"] += r["call_count"] or 0
            grouped[pid]["total_cost_usd"] += r["total_cost_usd"] or 0.0
            grouped[pid]["capabilities"].append({
                "capability_name": r["capability_name"],
                "call_count": r["call_count"],
                "total_cost_usd": r["total_cost_usd"],
                "avg_cost_usd": r["avg_cost_usd"],
                "avg_duration_ms": r["avg_duration_ms"],
                "provider": r["provider"],
                "capability_type": r["capability_type"],
            })
        return {"data": list(grouped.values()), "group_by": "persona"}

    # group_by == "consumer"
    async with db.execute(
        """SELECT c.id AS consumer_id, c.name AS consumer_name,
                  p.id AS persona_id, p.name AS persona_name,
                  ts.capability_name, ts.call_count,
                  ts.total_cost_usd, ts.avg_cost_usd, ts.avg_duration_ms,
                  ts.capability_type
           FROM token_stats ts
           JOIN persona_capability pc ON pc.capability_name = ts.capability_name
           JOIN personas p ON p.id = pc.persona_id
           JOIN consumer_persona cp ON cp.persona_id = p.id
           JOIN consumers c ON c.id = cp.consumer_id
           WHERE ts.toolkit_id = ? AND p.toolkit_id = ?
           ORDER BY c.name, p.name, ts.call_count DESC""",
        (tid, tid),
    ) as cur:
        rows = await cur.fetchall()

    grouped_c: dict[str, dict] = {}
    for r in rows:
        cid = r["consumer_id"]
        if cid not in grouped_c:
            grouped_c[cid] = {
                "consumer_id": cid,
                "consumer_name": r["consumer_name"],
                "total_calls": 0,
                "total_cost_usd": 0.0,
                "personas": {},
            }
        pid = r["persona_id"]
        if pid not in grouped_c[cid]["personas"]:
            grouped_c[cid]["personas"][pid] = {
                "persona_id": pid,
                "persona_name": r["persona_name"],
                "capabilities": [],
            }
        grouped_c[cid]["total_calls"] += r["call_count"] or 0
        grouped_c[cid]["total_cost_usd"] += r["total_cost_usd"] or 0.0
        grouped_c[cid]["personas"][pid]["capabilities"].append({
            "capability_name": r["capability_name"],
            "call_count": r["call_count"],
            "total_cost_usd": r["total_cost_usd"],
            "avg_cost_usd": r["avg_cost_usd"],
            "capability_type": r["capability_type"],
        })

    result = []
    for entry in grouped_c.values():
        entry["personas"] = list(entry["personas"].values())
        result.append(entry)
    return {"data": result, "group_by": "consumer"}


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
        async with db.execute(
            "SELECT * FROM bindings WHERE assembly_id=? ORDER BY capability_name", (aid,)
        ) as cur:
            bindings_rows = await cur.fetchall()
        async with db.execute(
            "SELECT * FROM assembly_dependency WHERE assembly_id=? ORDER BY name", (aid,)
        ) as cur:
            deps = await cur.fetchall()

        # Enrich bindings with agent detail
        bindings = []
        for b in bindings_rows:
            agent_detail = None
            if b["agent_name"]:
                async with db.execute(
                    "SELECT id, name, model, llm_class, orchestrator, guardrails, observability FROM agents WHERE name=? AND toolkit_id=?",
                    (b["agent_name"], tid),
                ) as cur:
                    ag_row = await cur.fetchone()
                if ag_row:
                    agent_detail = {
                        "id": ag_row["id"],
                        "name": ag_row["name"],
                        "model": ag_row["model"],
                        "llm_class": ag_row["llm_class"],
                        "orchestrator": _parse_bool(ag_row["orchestrator"]),
                        "guardrails": _parse_bool(ag_row["guardrails"]),
                        "observability": _parse_bool(ag_row["observability"]),
                    }
            bindings.append({
                "capability_name": b["capability_name"],
                "description": b["description"],
                "agent_name": b["agent_name"],
                "agent": agent_detail,
            })

        asm_list.append({
            **dict(a),
            "consumers":    [dict(c) for c in consumers],
            "personas":     [dict(p) for p in personas],
            "bindings":     bindings,
            "dependencies": [dict(d) for d in deps],
        })

    async with db.execute("SELECT * FROM agents WHERE toolkit_id=? ORDER BY name", (tid,)) as cur:
        agents = await cur.fetchall()

    agent_list = []
    for ag in agents:
        agd = dict(ag)
        agd["orchestrator"]    = _parse_bool(agd.get("orchestrator"))
        agd["session_history"] = _parse_bool(agd.get("session_history"))
        agd["guardrails"]      = _parse_bool(agd.get("guardrails"))
        agd["observability"]   = _parse_bool(agd.get("observability"))
        agent_list.append(agd)

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
        "agents":      agent_list,
        "tools":       tool_list,
        "token_stats": [dict(s) for s in stats],
    }


# ── Assembly-level endpoints ───────────────────────────────────────────────────

@router.get("/assemblies/{aid}/access-matrix")
async def get_access_matrix(aid: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT a.id, a.toolkit_id FROM assemblies a WHERE a.id=?", (aid,)
    ) as cur:
        asm = await cur.fetchone()
    if not asm:
        raise HTTPException(404, "Assembly not found")

    tid = asm["toolkit_id"]

    # Check if consumer-persona data exists
    async with db.execute(
        "SELECT COUNT(*) FROM consumer_persona cp "
        "JOIN consumers c ON c.id=cp.consumer_id WHERE c.assembly_id=?", (aid,)
    ) as cur:
        cp_count = (await cur.fetchone())[0]

    if cp_count == 0:
        return {
            "consumers": [],
            "warning": "No access data — re-publish from workbench to see consumer-persona grants",
        }

    async with db.execute(
        "SELECT * FROM consumers WHERE assembly_id=? ORDER BY name", (aid,)
    ) as cur:
        consumers = await cur.fetchall()

    result = []
    for c in consumers:
        cid = c["id"]
        async with db.execute(
            """SELECT p.id AS persona_id, p.name AS persona_name,
                      pc.capability_name,
                      ag.orchestrator, ag.guardrails, ag.observability
               FROM consumer_persona cp
               JOIN personas p ON p.id = cp.persona_id
               JOIN persona_capability pc ON pc.persona_id = p.id
               LEFT JOIN bindings b ON b.capability_name = pc.capability_name AND b.assembly_id = ?
               LEFT JOIN agents ag ON ag.name = b.agent_name AND ag.toolkit_id = ?
               WHERE cp.consumer_id = ?
               ORDER BY p.name, pc.capability_name""",
            (aid, tid, cid),
        ) as cur:
            rows = await cur.fetchall()

        caps = []
        for r in rows:
            g = _parse_bool(r["guardrails"])
            o = _parse_bool(r["observability"])
            caps.append({
                "capability_name": r["capability_name"],
                "via_persona": r["persona_name"],
                "agent_flags": {
                    "guardrails":   g,
                    "observability": o,
                },
                "flags_unknown": (g is None and o is None),
            })

        result.append({
            "id":   cid,
            "name": c["name"],
            "capabilities": caps,
        })

    return {"consumers": result}


# ── Individual entity endpoints ────────────────────────────────────────────────

@router.get("/consumers/{cid}")
async def get_consumer(cid: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT c.*, t.name AS toolkit_name FROM consumers c "
        "JOIN toolkits t ON t.id=c.toolkit_id WHERE c.id=?", (cid,)
    ) as cur:
        consumer = await cur.fetchone()
    if not consumer:
        raise HTTPException(404, "Consumer not found")

    aid = consumer["assembly_id"]
    tid = consumer["toolkit_id"]

    async with db.execute(
        """SELECT p.* FROM personas p
           JOIN consumer_persona cp ON cp.persona_id = p.id
           WHERE cp.consumer_id = ? ORDER BY p.name""",
        (cid,),
    ) as cur:
        personas = await cur.fetchall()

    persona_list = []
    for p in personas:
        pid = p["id"]
        async with db.execute(
            """SELECT pc.capability_name,
                      b.description AS binding_description,
                      b.agent_name,
                      ag.model, ag.orchestrator, ag.guardrails, ag.observability
               FROM persona_capability pc
               LEFT JOIN bindings b ON b.capability_name = pc.capability_name AND b.assembly_id = ?
               LEFT JOIN agents ag ON ag.name = b.agent_name AND ag.toolkit_id = ?
               WHERE pc.persona_id = ?
               ORDER BY pc.capability_name""",
            (aid, tid, pid),
        ) as cur:
            caps = await cur.fetchall()

        capabilities = []
        for cap in caps:
            capabilities.append({
                "capability_name": cap["capability_name"],
                "binding": {
                    "description": cap["binding_description"],
                    "agent_name": cap["agent_name"],
                    "agent": {
                        "model": cap["model"],
                        "orchestrator": _parse_bool(cap["orchestrator"]),
                        "guardrails": _parse_bool(cap["guardrails"]),
                        "observability": _parse_bool(cap["observability"]),
                    } if cap["agent_name"] else None,
                },
            })

        persona_list.append({
            **dict(p),
            "capabilities": capabilities,
        })

    return {
        **dict(consumer),
        "personas": persona_list,
        "has_persona_data": len(personas) > 0,
    }


@router.get("/agents/{aid}")
async def get_agent(aid: str, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute(
        "SELECT ag.*, t.name AS toolkit_name FROM agents ag "
        "JOIN toolkits t ON t.id=ag.toolkit_id WHERE ag.id=?", (aid,)
    ) as cur:
        agent = await cur.fetchone()
    if not agent:
        raise HTTPException(404, "Agent not found")

    tid = agent["toolkit_id"]
    agent_name = agent["name"]

    # Tools used via junction table
    async with db.execute(
        """SELECT tl.id, tl.name, tl.description, tl.input_schema, tl.output_description
           FROM agent_tool at_
           JOIN tools tl ON tl.id = at_.tool_id
           WHERE at_.agent_id = ?
           ORDER BY tl.name""",
        (aid,),
    ) as cur:
        tool_rows = await cur.fetchall()

    tools_used = []
    for t in tool_rows:
        td = dict(t)
        if td.get("input_schema"):
            try:
                td["input_schema"] = json.loads(td["input_schema"])
            except Exception:
                pass
        tools_used.append(td)

    # Impact trace: bindings → personas → consumers
    async with db.execute(
        """SELECT b.capability_name, b.assembly_id,
                  a.name AS assembly_name,
                  p.id AS persona_id, p.name AS persona_name,
                  c.id AS consumer_id, c.name AS consumer_name
           FROM bindings b
           JOIN assemblies a ON a.id = b.assembly_id
           JOIN persona_capability pc ON pc.capability_name = b.capability_name
           JOIN personas p ON p.id = pc.persona_id AND p.assembly_id = b.assembly_id
           JOIN consumer_persona cp ON cp.persona_id = p.id
           JOIN consumers c ON c.id = cp.consumer_id
           WHERE b.agent_name = ? AND a.toolkit_id = ?
           ORDER BY a.name, b.capability_name, p.name, c.name""",
        (agent_name, tid),
    ) as cur:
        impact_rows = await cur.fetchall()

    # Group impact by assembly → capability → persona → consumers
    impact: dict[str, dict] = {}
    for r in impact_rows:
        asm_id = r["assembly_id"]
        if asm_id not in impact:
            impact[asm_id] = {"assembly_name": r["assembly_name"], "bindings": {}}
        cap = r["capability_name"]
        if cap not in impact[asm_id]["bindings"]:
            impact[asm_id]["bindings"][cap] = {"capability_name": cap, "personas": {}}
        pid = r["persona_id"]
        if pid not in impact[asm_id]["bindings"][cap]["personas"]:
            impact[asm_id]["bindings"][cap]["personas"][pid] = {
                "persona_name": r["persona_name"], "consumers": [],
            }
        impact[asm_id]["bindings"][cap]["personas"][pid]["consumers"].append(r["consumer_name"])

    impact_list = []
    for asm_entry in impact.values():
        bindings_list = []
        for b_entry in asm_entry["bindings"].values():
            b_entry["personas"] = list(b_entry["personas"].values())
            bindings_list.append(b_entry)
        impact_list.append({"assembly_name": asm_entry["assembly_name"], "bindings": bindings_list})

    agd = dict(agent)
    agd["orchestrator"]    = _parse_bool(agd.get("orchestrator"))
    agd["session_history"] = _parse_bool(agd.get("session_history"))
    agd["guardrails"]      = _parse_bool(agd.get("guardrails"))
    agd["observability"]   = _parse_bool(agd.get("observability"))

    return {
        **agd,
        "tools_used": tools_used,
        "impact_trace": impact_list,
        "has_impact_data": len(impact_list) > 0,
    }


# ── Browse views ──────────────────────────────────────────────────────────────

@router.get("/consumers")
async def list_consumers(
    q: str | None = None,
    toolkit_id: str | None = None,
    db: aiosqlite.Connection = Depends(get_db),
):
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
async def list_personas(
    q: str | None = None,
    toolkit_id: str | None = None,
    db: aiosqlite.Connection = Depends(get_db),
):
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
async def list_agents(
    q: str | None = None,
    toolkit_id: str | None = None,
    consumer_id: str | None = None,
    persona_id: str | None = None,
    orchestrator: str | None = None,
    guardrails: str | None = None,
    observability: str | None = None,
    db: aiosqlite.Connection = Depends(get_db),
):
    wheres, params = [], []
    if q:
        wheres.append("(a.name LIKE ? OR a.description LIKE ?)")
        params += [f"%{q}%", f"%{q}%"]
    if toolkit_id:
        wheres.append("a.toolkit_id = ?")
        params.append(toolkit_id)
    if orchestrator in ("true", "false"):
        wheres.append("a.orchestrator = ?")
        params.append(1 if orchestrator == "true" else 0)
    if guardrails in ("true", "false"):
        wheres.append("a.guardrails = ?")
        params.append(1 if guardrails == "true" else 0)
    if observability in ("true", "false"):
        wheres.append("a.observability = ?")
        params.append(1 if observability == "true" else 0)

    # Consumer/persona filters: agent must appear in a binding reachable from the given consumer/persona
    if consumer_id:
        wheres.append(
            """a.name IN (
               SELECT b.agent_name FROM bindings b
               JOIN persona_capability pc ON pc.capability_name = b.capability_name
               JOIN consumer_persona cp ON cp.persona_id = pc.persona_id
               WHERE cp.consumer_id = ?
            )"""
        )
        params.append(consumer_id)
    elif persona_id:
        wheres.append(
            """a.name IN (
               SELECT b.agent_name FROM bindings b
               JOIN persona_capability pc ON pc.capability_name = b.capability_name
               WHERE pc.persona_id = ?
            )"""
        )
        params.append(persona_id)

    clause = ("WHERE " + " AND ".join(wheres)) if wheres else ""
    async with db.execute(
        f"SELECT a.*, t.name AS toolkit_name FROM agents a "
        f"JOIN toolkits t ON t.id=a.toolkit_id {clause} ORDER BY a.name",
        params,
    ) as cur:
        rows = await cur.fetchall()

    result = []
    for row in rows:
        rd = dict(row)
        rd["orchestrator"]    = _parse_bool(rd.get("orchestrator"))
        rd["session_history"] = _parse_bool(rd.get("session_history"))
        rd["guardrails"]      = _parse_bool(rd.get("guardrails"))
        rd["observability"]   = _parse_bool(rd.get("observability"))
        result.append(rd)
    return result


@router.get("/tools")
async def list_tools(
    q: str | None = None,
    toolkit_id: str | None = None,
    db: aiosqlite.Connection = Depends(get_db),
):
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
