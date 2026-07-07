import json
import os
import uuid
from datetime import datetime, timezone

import aiosqlite
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from database import get_db

router = APIRouter(prefix="/api/catalog", tags=["push"])


def _check_auth(x_catalog_key: str | None) -> None:
    required = os.environ.get("CATALOG_API_KEY", "")
    if required and x_catalog_key != required:
        raise HTTPException(401, "Invalid or missing X-Catalog-Key")


def _bool_col(v: bool | None) -> int | None:
    return None if v is None else (1 if v else 0)


# ── Pydantic models ───────────────────────────────────────────────────────────

class ConsumerRecord(BaseModel):
    consumer_id: str
    name: str
    description: str | None = None


class PersonaRecord(BaseModel):
    persona_id: str
    name: str
    description: str | None = None
    capability_count: int = 0


class BindingRecord(BaseModel):
    capability_name: str
    description: str | None = None
    agent_name: str | None = None


class DependencyRecord(BaseModel):
    name: str
    url: str | None = None
    required: bool = False
    description: str | None = None


class ConsumerPersonaGrant(BaseModel):
    consumer_id: str   # original YAML consumer_id
    persona_id: str    # original YAML persona_id


class PersonaCapabilityRecord(BaseModel):
    persona_id: str    # original YAML persona_id
    capability_name: str


class AssemblyRecord(BaseModel):
    assembly_id: str
    name: str
    description: str | None = None
    gateway_port: int | None = None
    raw_yaml: str | None = None
    version: str | None = None
    base_url: str | None = None
    consumers: list[ConsumerRecord] = []
    personas: list[PersonaRecord] = []
    bindings: list[BindingRecord] = []
    dependencies: list[DependencyRecord] = []
    consumer_persona_grants: list[ConsumerPersonaGrant] = []
    persona_capabilities: list[PersonaCapabilityRecord] = []


class AgentRecord(BaseModel):
    agent_id: str
    name: str
    description: str | None = None
    tools_used: list[str] = []
    llm_class: str | None = None
    model: str | None = None
    orchestrator: bool | None = None
    session_history: bool | None = None
    guardrails: bool | None = None
    observability: bool | None = None
    max_tokens: int | None = None


class ToolRecord(BaseModel):
    tool_id: str
    name: str
    description: str | None = None
    input_schema: dict | None = None
    output_description: str | None = None


class TokenStatRecord(BaseModel):
    capability_name: str
    call_count: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    total_duration_ms: float = 0.0
    provider: str | None = None
    capability_type: str | None = None  # "agent" or "tool"


class ToolkitSnapshot(BaseModel):
    name: str
    description: str | None = None
    owner: str | None = None
    tags: list[str] = []
    repo_url: str | None = None
    git_branch: str | None = None
    git_last_commit: str | None = None
    git_is_dirty: bool = False
    assemblies: list[AssemblyRecord] = []
    agents: list[AgentRecord] = []
    tools: list[ToolRecord] = []
    token_stats: list[TokenStatRecord] = []
    publisher_name: str | None = None
    publisher_email: str | None = None
    claim_ownership: bool = False


# ── Delete endpoint ───────────────────────────────────────────────────────────

@router.delete("/toolkits/{tid}")
async def delete_toolkit(
    tid: str,
    db: aiosqlite.Connection = Depends(get_db),
    x_catalog_key: str | None = Header(default=None),
):
    _check_auth(x_catalog_key)
    async with db.execute("SELECT id FROM toolkits WHERE id=?", (tid,)) as cur:
        if not await cur.fetchone():
            raise HTTPException(404, "Toolkit not found")
    await db.execute("DELETE FROM toolkits WHERE id=?", (tid,))
    await db.commit()
    return {"status": "ok", "deleted_toolkit_id": tid}


# ── Push endpoint ─────────────────────────────────────────────────────────────

@router.post("/push")
async def push_toolkit(
    snapshot: ToolkitSnapshot,
    db: aiosqlite.Connection = Depends(get_db),
    x_catalog_key: str | None = Header(default=None),
):
    _check_auth(x_catalog_key)
    now = datetime.now(timezone.utc).isoformat()

    # Upsert toolkit by name
    async with db.execute("SELECT id FROM toolkits WHERE name=?", (snapshot.name,)) as cur:
        row = await cur.fetchone()

    if row:
        tid = row["id"]
        async with db.execute("SELECT owner_name, owner_email FROM toolkits WHERE id=?", (tid,)) as ocur:
            orow = await ocur.fetchone()
        new_owner_name  = snapshot.publisher_name  if snapshot.claim_ownership else (orow["owner_name"]  if orow else None)
        new_owner_email = snapshot.publisher_email if snapshot.claim_ownership else (orow["owner_email"] if orow else None)
        await db.execute(
            """UPDATE toolkits
               SET description=?, repo_url=?, owner=?, tags=?,
                   git_branch=?, git_last_commit=?, git_is_dirty=?, last_published_at=?,
                   publisher_name=?, publisher_email=?,
                   owner_name=?, owner_email=?
               WHERE id=?""",
            (
                snapshot.description, snapshot.repo_url, snapshot.owner,
                ",".join(snapshot.tags), snapshot.git_branch, snapshot.git_last_commit,
                1 if snapshot.git_is_dirty else 0, now,
                snapshot.publisher_name, snapshot.publisher_email,
                new_owner_name, new_owner_email,
                tid,
            ),
        )
    else:
        tid = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO toolkits
               (id, name, description, repo_url, owner, tags,
                git_branch, git_last_commit, git_is_dirty,
                first_published_at, last_published_at,
                publisher_name, publisher_email,
                owner_name, owner_email)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                tid, snapshot.name, snapshot.description, snapshot.repo_url,
                snapshot.owner, ",".join(snapshot.tags),
                snapshot.git_branch, snapshot.git_last_commit,
                1 if snapshot.git_is_dirty else 0, now, now,
                snapshot.publisher_name, snapshot.publisher_email,
                snapshot.publisher_name, snapshot.publisher_email,
            ),
        )

    # Push history
    await db.execute(
        """INSERT INTO toolkit_pushes (id, toolkit_id, pushed_at, pusher_name, pusher_email, git_branch, git_last_commit)
           VALUES (?,?,?,?,?,?,?)""",
        (str(uuid.uuid4()), tid, now,
         snapshot.publisher_name, snapshot.publisher_email,
         snapshot.git_branch, snapshot.git_last_commit),
    )

    # Replace assemblies (CASCADE removes consumers, personas, bindings, dependencies)
    await db.execute("DELETE FROM assemblies WHERE toolkit_id=?", (tid,))

    # Track YAML IDs → DB UUIDs for junction tables
    consumer_db_ids: dict[tuple[str, str], str] = {}  # (aid, yaml_consumer_id) → db_uuid
    persona_db_ids: dict[tuple[str, str], str] = {}   # (aid, yaml_persona_id) → db_uuid

    for asm in snapshot.assemblies:
        aid = str(uuid.uuid4())
        await db.execute(
            """INSERT INTO assemblies
               (id, toolkit_id, name, description, gateway_port, raw_yaml, published_at, version, base_url)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (aid, tid, asm.name, asm.description, asm.gateway_port, asm.raw_yaml, now,
             asm.version, asm.base_url),
        )
        for c in asm.consumers:
            cid = str(uuid.uuid4())
            consumer_db_ids[(aid, c.consumer_id)] = cid
            await db.execute(
                "INSERT INTO consumers (id, assembly_id, toolkit_id, name, description) VALUES (?,?,?,?,?)",
                (cid, aid, tid, c.name, c.description),
            )
        for p in asm.personas:
            pid = str(uuid.uuid4())
            persona_db_ids[(aid, p.persona_id)] = pid
            await db.execute(
                """INSERT INTO personas
                   (id, assembly_id, toolkit_id, name, description, capability_count)
                   VALUES (?,?,?,?,?,?)""",
                (pid, aid, tid, p.name, p.description, p.capability_count),
            )
        for b in asm.bindings:
            await db.execute(
                "INSERT INTO bindings (id, assembly_id, capability_name, description, agent_name) VALUES (?,?,?,?,?)",
                (str(uuid.uuid4()), aid, b.capability_name, b.description, b.agent_name),
            )
        for dep in asm.dependencies:
            await db.execute(
                """INSERT INTO assembly_dependency (id, assembly_id, name, url, required, description)
                   VALUES (?,?,?,?,?,?)""",
                (str(uuid.uuid4()), aid, dep.name, dep.url, 1 if dep.required else 0, dep.description),
            )
        for grant in asm.consumer_persona_grants:
            cdb = consumer_db_ids.get((aid, grant.consumer_id))
            pdb = persona_db_ids.get((aid, grant.persona_id))
            if cdb and pdb:
                await db.execute(
                    "INSERT OR IGNORE INTO consumer_persona (consumer_id, persona_id) VALUES (?,?)",
                    (cdb, pdb),
                )
        for pc in asm.persona_capabilities:
            pdb = persona_db_ids.get((aid, pc.persona_id))
            if pdb:
                await db.execute(
                    "INSERT OR IGNORE INTO persona_capability (persona_id, capability_name) VALUES (?,?)",
                    (pdb, pc.capability_name),
                )

    # Replace agents and tools, tracking IDs for agent_tool junction
    await db.execute("DELETE FROM agents WHERE toolkit_id=?", (tid,))
    agent_db_ids: dict[str, str] = {}  # agent_name → db_uuid

    for ag in snapshot.agents:
        agid = str(uuid.uuid4())
        agent_db_ids[ag.name] = agid
        await db.execute(
            """INSERT INTO agents
               (id, toolkit_id, name, description, tools_used, llm_class, model,
                orchestrator, session_history, guardrails, observability, max_tokens)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                agid, tid, ag.name, ag.description,
                ",".join(ag.tools_used), ag.llm_class, ag.model,
                _bool_col(ag.orchestrator), _bool_col(ag.session_history),
                _bool_col(ag.guardrails), _bool_col(ag.observability),
                ag.max_tokens,
            ),
        )

    await db.execute("DELETE FROM tools WHERE toolkit_id=?", (tid,))
    tool_db_ids: dict[str, str] = {}  # tool_name → db_uuid

    for t in snapshot.tools:
        tid_tool = str(uuid.uuid4())
        tool_db_ids[t.name] = tid_tool
        await db.execute(
            """INSERT INTO tools
               (id, toolkit_id, name, description, input_schema, output_description)
               VALUES (?,?,?,?,?,?)""",
            (
                tid_tool, tid, t.name, t.description,
                json.dumps(t.input_schema) if t.input_schema else None,
                t.output_description,
            ),
        )

    # Populate agent_tool junction
    for ag in snapshot.agents:
        agid = agent_db_ids.get(ag.name)
        if not agid:
            continue
        for tool_name in ag.tools_used:
            tool_db_id = tool_db_ids.get(tool_name)
            if tool_db_id:
                await db.execute(
                    "INSERT OR IGNORE INTO agent_tool (agent_id, tool_id) VALUES (?,?)",
                    (agid, tool_db_id),
                )

    # Accumulate token stats
    for ts in snapshot.token_stats:
        if ts.call_count <= 0:
            continue
        await db.execute(
            """INSERT INTO token_stats
               (id, toolkit_id, capability_name, call_count,
                total_input_tokens, total_output_tokens, total_cost_usd,
                avg_input_tokens, avg_output_tokens, avg_cost_usd,
                total_duration_ms, avg_duration_ms,
                provider, capability_type, last_updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(toolkit_id, capability_name) DO UPDATE SET
                   call_count             = call_count + excluded.call_count,
                   total_input_tokens     = total_input_tokens + excluded.total_input_tokens,
                   total_output_tokens    = total_output_tokens + excluded.total_output_tokens,
                   total_cost_usd         = total_cost_usd + excluded.total_cost_usd,
                   avg_input_tokens       = (total_input_tokens + excluded.total_input_tokens)
                                            / (call_count + excluded.call_count),
                   avg_output_tokens      = (total_output_tokens + excluded.total_output_tokens)
                                            / (call_count + excluded.call_count),
                   avg_cost_usd           = (total_cost_usd + excluded.total_cost_usd)
                                            / (call_count + excluded.call_count),
                   total_duration_ms      = total_duration_ms + excluded.total_duration_ms,
                   avg_duration_ms        = (total_duration_ms + excluded.total_duration_ms)
                                            / (call_count + excluded.call_count),
                   provider               = excluded.provider,
                   capability_type        = excluded.capability_type,
                   last_updated_at        = excluded.last_updated_at""",
            (
                str(uuid.uuid4()), tid, ts.capability_name, ts.call_count,
                ts.total_input_tokens, ts.total_output_tokens, ts.total_cost_usd,
                ts.total_input_tokens / ts.call_count,
                ts.total_output_tokens / ts.call_count,
                ts.total_cost_usd / ts.call_count,
                ts.total_duration_ms,
                ts.total_duration_ms / ts.call_count if ts.total_duration_ms else None,
                ts.provider, ts.capability_type, now,
            ),
        )

    await db.commit()
    return {"status": "ok", "toolkit_id": tid, "name": snapshot.name}
