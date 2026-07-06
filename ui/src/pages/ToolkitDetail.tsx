import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle, BarChart3, Bot, CheckCircle, ChevronDown, ChevronRight,
  Crown, Download, ExternalLink, Eye, GitBranch, GitCommitHorizontal,
  HelpCircle, Link2, Network, Shield, Tag, User, Users, Wrench, XCircle,
} from "lucide-react";
import {
  api, AssemblyDetail, ToolkitDetail as TDetail, PushRecord,
  AccessMatrix, TokenStatGrouped, parseTags, parseList,
  flagColor, flagLabel,
} from "../lib/api";
import { TagChip } from "../components/TagChip";

function Section({
  title, count, children, defaultOpen = true,
}: { title: string; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-0 bg-surface-raised border border-surface-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between px-6 py-4 text-left hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200">{title}</span>
          {count !== undefined && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
              {count}
            </span>
          )}
        </div>
        {open ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
      </button>
      {open && <div className="border-t border-surface-border px-6 py-5">{children}</div>}
    </div>
  );
}

// ── Governance heat map for one assembly ──────────────────────────────────────

function GovernanceMatrix({ assembly }: { assembly: AssemblyDetail }) {
  const [matrix, setMatrix]   = useState<AccessMatrix | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  const load = () => {
    if (loaded) return;
    setLoading(true);
    api.accessMatrix(assembly.id)
      .then(setMatrix)
      .catch(() => {})
      .finally(() => { setLoading(false); setLoaded(true); });
  };

  if (!loaded) return (
    <button onClick={load}
      className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-accent transition-colors border border-surface-border/60 rounded-lg px-3 py-1.5">
      <BarChart3 size={11} /> Load access matrix
    </button>
  );

  if (loading) return <div className="h-8 w-40 animate-pulse bg-surface rounded" />;
  if (!matrix) return null;

  if (matrix.warning) return (
    <div className="flex items-center gap-2 text-[11px] text-amber-400">
      <AlertCircle size={11} /> {matrix.warning}
    </div>
  );

  if (matrix.consumers.length === 0) return (
    <p className="text-[11px] text-slate-600">No consumer access data.</p>
  );

  // Collect all unique capability names across all consumers
  const allCaps = [...new Set(
    matrix.consumers.flatMap((c) => c.capabilities.map((cap) => cap.capability_name))
  )].sort();

  return (
    <div className="overflow-x-auto mt-2">
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="text-left pr-3 pb-1.5 text-slate-600 font-semibold">Consumer</th>
            {allCaps.map((cap) => (
              <th key={cap} className="text-center pb-1.5 px-1.5 text-slate-600 font-mono font-normal rotate-0 whitespace-nowrap max-w-[80px] truncate">
                {cap}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.consumers.map((consumer) => {
            const capMap = new Map(consumer.capabilities.map((c) => [c.capability_name, c]));
            return (
              <tr key={consumer.id} className="border-t border-surface-border/30">
                <td className="py-1.5 pr-3 text-slate-300 font-medium whitespace-nowrap">
                  <Link to={`/consumers/${consumer.id}`} className="hover:text-accent transition-colors">
                    {consumer.name}
                  </Link>
                </td>
                {allCaps.map((cap) => {
                  const c = capMap.get(cap);
                  if (!c) return (
                    <td key={cap} className="text-center px-1.5 py-1.5 text-slate-700">—</td>
                  );
                  const g = c.agent_flags.guardrails;
                  const o = c.agent_flags.observability;
                  const both = g === true && o === true;
                  const neither = g === false || o === false;
                  return (
                    <td key={cap} className={`text-center px-1.5 py-1.5 rounded ${
                      both ? "bg-emerald-900/30 text-emerald-400"
                        : neither ? "bg-red-900/20 text-red-400"
                          : c.flags_unknown ? "bg-surface text-slate-500"
                            : "bg-amber-900/20 text-amber-400"
                    }`} title={`${cap}: G=${flagLabel(g)} O=${flagLabel(o)}`}>
                      ✓
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex gap-4 mt-2 text-[10px] text-slate-600">
        <span><span className="text-emerald-400">✓</span> guardrails+observability on</span>
        <span><span className="text-amber-400">✓</span> partial</span>
        <span><span className="text-red-400">✓</span> off</span>
        <span><span className="text-slate-500">✓</span> unknown</span>
      </div>
    </div>
  );
}

// ── Token pivot view ──────────────────────────────────────────────────────────

type GroupBy = "flat" | "persona" | "consumer";

function TokenPivot({ tkId, flatStats }: { tkId: string; flatStats: TDetail["token_stats"] }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("flat");
  const [grouped, setGrouped] = useState<TokenStatGrouped | null>(null);
  const [loading, setLoading] = useState(false);

  const loadGrouped = (g: "persona" | "consumer") => {
    setGroupBy(g);
    if (grouped?.group_by === g) return;
    setLoading(true);
    api.tokenStats(tkId, g)
      .then((r) => setGrouped(r as TokenStatGrouped))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const tokenTotal = flatStats.reduce((a, s) => a + s.call_count, 0);
  const costTotal  = flatStats.reduce((a, s) => a + (s.total_cost_usd ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Toggle */}
      <div className="flex gap-1">
        {(["flat", "persona", "consumer"] as GroupBy[]).map((g) => (
          <button key={g} onClick={() => g === "flat" ? setGroupBy("flat") : loadGrouped(g as "persona" | "consumer")}
            className={`px-3 py-1.5 text-[11px] rounded-lg border transition-colors capitalize ${
              groupBy === g
                ? "border-accent bg-accent/10 text-accent"
                : "border-surface-border text-slate-500 hover:text-slate-300"
            }`}>
            {g === "flat" ? "All capabilities" : `By ${g}`}
          </button>
        ))}
      </div>

      {loading && <div className="h-16 animate-pulse bg-surface rounded-lg" />}

      {!loading && groupBy === "flat" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Capability</th>
                <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Calls</th>
                <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Avg In</th>
                <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Avg Out</th>
                <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Avg Cost</th>
                <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Avg Resp</th>
                <th className="text-right py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Provider</th>
              </tr>
            </thead>
            <tbody>
              {flatStats.map((s) => {
                const isTool = s.capability_type === "tool";
                const dur = s.avg_duration_ms != null
                  ? s.avg_duration_ms >= 60000
                    ? `${(s.avg_duration_ms / 60000).toFixed(1)}m`
                    : `${(s.avg_duration_ms / 1000).toFixed(1)}s`
                  : "—";
                return (
                  <tr key={s.id} className="border-b border-surface-border/40 hover:bg-surface-hover/30">
                    <td className="py-2.5 pr-4 font-mono text-slate-300">
                      <span className="flex items-center gap-1.5">
                        {isTool ? <Wrench size={11} className="text-slate-500 shrink-0" /> : <Bot size={11} className="text-accent shrink-0" />}
                        {s.capability_name}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-300">{s.call_count.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-500">
                      {isTool ? <span className="text-slate-700">—</span> : (s.avg_input_tokens != null ? Math.round(s.avg_input_tokens).toLocaleString() : "—")}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-500">
                      {isTool ? <span className="text-slate-700">—</span> : (s.avg_output_tokens != null ? Math.round(s.avg_output_tokens).toLocaleString() : "—")}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-500">
                      {isTool ? <span className="text-slate-700">—</span> : (s.avg_cost_usd != null ? `$${s.avg_cost_usd.toFixed(5)}` : "—")}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-500">{dur}</td>
                    <td className="py-2.5 text-right text-slate-600 text-[10px]">
                      {isTool ? <span className="text-slate-700">—</span> : (s.provider ?? "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && grouped && groupBy !== "flat" && (
        <div className="flex flex-col gap-3">
          {(grouped.warning) && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
              <AlertCircle size={12} /> {grouped.warning}
            </div>
          )}
          {(grouped.data as any[]).map((group: any) => (
            <div key={group.persona_id ?? group.consumer_id}
              className="border border-surface-border/60 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-surface-border/40">
                <span className="text-sm font-semibold text-slate-200">
                  {group.persona_name ?? group.consumer_name}
                </span>
                <div className="flex gap-4 text-[11px] text-slate-500">
                  <span className="tabular-nums">{(group.total_calls as number).toLocaleString()} calls</span>
                  <span className="tabular-nums text-gold">${(group.total_cost_usd as number).toFixed(5)}</span>
                </div>
              </div>
              {/* For consumer: show personas nested */}
              {group.personas ? (
                (group.personas as any[]).map((p: any) => (
                  <div key={p.persona_id}>
                    <p className="px-4 py-1.5 text-[10px] text-slate-600 border-b border-surface-border/30">
                      persona: <span className="text-slate-400">{p.persona_name}</span>
                    </p>
                    <CapabilityStatRows caps={p.capabilities} />
                  </div>
                ))
              ) : (
                <CapabilityStatRows caps={group.capabilities} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-6 pt-2 border-t border-surface-border/50 text-[11px] text-slate-500">
        <span>Total calls: <b className="text-slate-300">{tokenTotal.toLocaleString()}</b></span>
        <span>Total cost: <b className="text-gold">${costTotal.toFixed(5)}</b></span>
      </div>
    </div>
  );
}

function CapabilityStatRows({ caps }: { caps: any[] }) {
  return (
    <div className="divide-y divide-surface-border/20">
      {caps.map((c: any) => (
        <div key={c.capability_name} className="flex items-center justify-between px-5 py-1.5 text-[11px]">
          <span className="font-mono text-slate-400">{c.capability_name}</span>
          <div className="flex gap-4 tabular-nums text-slate-600">
            <span>{(c.call_count as number).toLocaleString()}</span>
            {c.avg_cost_usd != null && <span>${(c.avg_cost_usd as number).toFixed(5)} avg</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Readiness checklist ───────────────────────────────────────────────────────

type CheckStatus = "pass" | "fail" | "warn" | "unknown";

interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
}

function ReadinessCheck({ check }: { check: Check }) {
  const Icon = check.status === "pass" ? CheckCircle
    : check.status === "fail" ? XCircle
      : check.status === "warn" ? AlertCircle
        : HelpCircle;
  const color = check.status === "pass" ? "text-emerald-400"
    : check.status === "fail" ? "text-red-400"
      : check.status === "warn" ? "text-amber-400"
        : "text-slate-600";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-border/30 last:border-0">
      <Icon size={15} className={`${color} shrink-0 mt-0.5`} />
      <div>
        <p className={`text-xs font-medium ${color}`}>{check.label}</p>
        <p className="text-[11px] text-slate-600 mt-0.5">{check.detail}</p>
      </div>
    </div>
  );
}

function buildReadinessChecks(toolkit: TDetail): Check[] {
  const checks: Check[] = [];

  const hasBindings = toolkit.assemblies.some((a) => (a.bindings ?? []).length > 0);
  checks.push({
    label: "Full domain indexed",
    status: hasBindings ? "pass" : "warn",
    detail: hasBindings
      ? "Bindings, personas and consumers are indexed."
      : "No bindings found — re-publish from workbench to index the full domain model.",
  });

  const unboundCaps = toolkit.assemblies.flatMap(
    (a) => (a.bindings ?? []).filter((b) => !b.agent_name)
  );
  checks.push({
    label: "All capabilities bound",
    status: unboundCaps.length === 0 ? (hasBindings ? "pass" : "unknown") : "warn",
    detail: unboundCaps.length === 0
      ? "Every capability slot has an assigned agent."
      : `${unboundCaps.length} capability/ies have no agent assigned: ${unboundCaps.map((b) => b.capability_name).join(", ")}.`,
  });

  const agentsWithFlagData = toolkit.agents.filter((a) => a.guardrails !== null);
  const guardrailsOn  = agentsWithFlagData.filter((a) => a.guardrails  === true).length;
  const guardrailsOff = agentsWithFlagData.filter((a) => a.guardrails  === false).length;
  checks.push({
    label: "Guardrails",
    status: agentsWithFlagData.length === 0 ? "unknown"
      : guardrailsOff > 0 ? "fail"
        : "pass",
    detail: agentsWithFlagData.length === 0
      ? "Guardrails flag not indexed — re-publish to see guardrail status."
      : `${guardrailsOn}/${agentsWithFlagData.length} agents have guardrails enabled.${guardrailsOff > 0 ? " Agents without guardrails are a compliance risk." : ""}`,
  });

  const obsOn  = toolkit.agents.filter((a) => a.observability === true).length;
  const obsOff = toolkit.agents.filter((a) => a.observability === false).length;
  const obsIndexed = toolkit.agents.some((a) => a.observability !== null);
  checks.push({
    label: "Observability",
    status: !obsIndexed ? "unknown" : obsOff > 0 ? "warn" : "pass",
    detail: !obsIndexed
      ? "Observability flag not indexed — re-publish to see status."
      : `${obsOn}/${toolkit.agents.length} agents have observability enabled.`,
  });

  const toolsWithSchema = toolkit.tools.filter((t) => t.input_schema != null).length;
  checks.push({
    label: "Tool schemas",
    status: toolkit.tools.length === 0 ? "unknown"
      : toolsWithSchema === toolkit.tools.length ? "pass"
        : toolsWithSchema === 0 ? "warn"
          : "warn",
    detail: toolkit.tools.length === 0
      ? "No tools registered."
      : `${toolsWithSchema}/${toolkit.tools.length} tools have input schemas indexed.`,
  });

  const hasConsumerPersonaData = toolkit.assemblies.some(
    (a) => a.consumers.length > 0 && a.personas.length > 0
  );
  checks.push({
    label: "Consumer access model",
    status: hasConsumerPersonaData ? "pass" : "warn",
    detail: hasConsumerPersonaData
      ? "Consumers and personas are linked — governance heat map is available."
      : "No consumer-persona links found — re-publish from workbench to see access control model.",
  });

  return checks;
}

// ── Main component ────────────────────────────────────────────────────────────

export function ToolkitDetail() {
  const { id } = useParams<{ id: string }>();
  const [toolkit, setToolkit] = useState<TDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState<string | null>(null);
  const [pushes, setPushes]   = useState<PushRecord[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.toolkit(id)
      .then(setToolkit)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
    api.toolkitPushes(id).then((r) => setPushes(r.pushes)).catch(() => {});
  }, [id]);

  const downloadSpec = async () => {
    if (!id || !toolkit) return;
    const res = await api.spec(id);
    if (!res.ok) return;
    const text = await res.text();
    const blob = new Blob([text], { type: "text/yaml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${toolkit.name.replace(/\s+/g, "-").toLowerCase()}-spec.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-6 pt-24 pb-16 flex flex-col gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 bg-surface-raised border border-surface-border rounded-xl animate-pulse" />
      ))}
    </div>
  );

  if (err || !toolkit) return (
    <div className="max-w-5xl mx-auto px-6 pt-24 text-status-failed text-sm">{err ?? "Not found"}</div>
  );

  const tags     = parseTags(toolkit.tags);
  const hasGit   = toolkit.git_branch || toolkit.git_last_commit;
  const statsMap = new Map(toolkit.token_stats.map((s) => [s.capability_name, s]));
  const checks   = buildReadinessChecks(toolkit);
  const passCount = checks.filter((c) => c.status === "pass").length;

  return (
    <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-4">
        <Link to="/" className="hover:text-slate-300 transition-colors">Home</Link>
        <span>›</span>
        <Link to="/toolkits" className="hover:text-slate-300 transition-colors">Toolkits</Link>
        <span>›</span>
        <span className="text-slate-300">{toolkit.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 bg-surface-raised border border-surface-border rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-purple-500 to-accent" />

        <div className="flex items-start gap-3 justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-black text-slate-100">{toolkit.name}</h1>
            {(toolkit.owner_name || toolkit.owner) && (
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Crown size={12} className="text-gold" />
                {toolkit.owner_name
                  ? `${toolkit.owner_name}${toolkit.owner_email ? ` <${toolkit.owner_email}>` : ""}`
                  : toolkit.owner}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span title={`${passCount}/${checks.length} readiness checks passed`}
              className={`text-[11px] px-2 py-1 rounded-lg border font-medium ${
                passCount === checks.length
                  ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-400"
                  : passCount >= checks.length / 2
                    ? "border-amber-700/50 bg-amber-900/20 text-amber-400"
                    : "border-red-700/50 bg-red-900/20 text-red-400"
              }`}>
              {passCount}/{checks.length} ready
            </span>
            <button
              onClick={downloadSpec}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-surface-border text-slate-400 rounded-lg hover:border-accent hover:text-accent transition-colors"
            >
              <Download size={13} /> Spec
            </button>
          </div>
        </div>

        {toolkit.description && (
          <p className="text-sm text-slate-400 leading-relaxed">{toolkit.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => <TagChip key={tag} tag={tag} />)}
        </div>

        {hasGit && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1 border-t border-surface-border/50">
            {toolkit.git_branch && (
              <span className="flex items-center gap-1.5 font-mono text-slate-400 bg-surface border border-surface-border px-2.5 py-1 rounded-lg">
                <GitBranch size={12} className="text-accent" />
                {toolkit.git_branch}
              </span>
            )}
            {toolkit.git_last_commit && (
              <span className="flex items-center gap-1.5 font-mono text-slate-500">
                <GitCommitHorizontal size={12} />
                {toolkit.git_last_commit}
              </span>
            )}
            {toolkit.repo_url && (
              <a href={toolkit.repo_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-accent hover:text-accent-hover transition-colors">
                <ExternalLink size={12} /> Repo
              </a>
            )}
            {Boolean(toolkit.git_is_dirty) && (
              <span className="flex items-center gap-1 text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2 py-0.5 rounded-lg text-[10px]">
                ⚠ Published with uncommitted changes
              </span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 pt-1">
          <span>First published {new Date(toolkit.first_published_at).toLocaleString()}</span>
          <span className="text-slate-600">·</span>
          <span>Updated {new Date(toolkit.last_published_at).toLocaleString()}</span>
          {toolkit.publisher_name && (
            <>
              <span className="text-slate-600">·</span>
              <span className="flex items-center gap-1">
                <User size={11} /> {toolkit.publisher_name}
                {toolkit.publisher_email && <span className="text-slate-600">&lt;{toolkit.publisher_email}&gt;</span>}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Assemblies (FDU-10: bindings, version, base_url, deps + FDU-13: governance matrix) */}
      {toolkit.assemblies.length > 0 && (
        <Section title="Assemblies" count={toolkit.assemblies.length}>
          <div className="flex flex-col gap-5">
            {toolkit.assemblies.map((asm) => (
              <div key={asm.id} className="flex flex-col gap-3 border border-surface-border/60 rounded-lg p-4">
                {/* Header row */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-slate-200">{asm.name}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {asm.version && (
                      <span className="font-mono text-[10px] text-slate-500 bg-surface px-2 py-0.5 rounded border border-surface-border">
                        v{asm.version}
                      </span>
                    )}
                    {asm.gateway_port && (
                      <span className="font-mono text-[10px] text-slate-600 bg-surface px-2 py-0.5 rounded border border-surface-border">
                        :{asm.gateway_port}
                      </span>
                    )}
                    {asm.base_url && (
                      <a href={asm.base_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover transition-colors">
                        <Link2 size={10} /> {asm.base_url}
                      </a>
                    )}
                  </div>
                </div>
                {asm.description && <p className="text-xs text-slate-500">{asm.description}</p>}

                {/* Consumers + Personas */}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {asm.consumers.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Consumers</span>
                      {asm.consumers.map((c) => (
                        <Link key={c.id} to={`/consumers/${c.id}`}
                          className="block text-slate-400 hover:text-accent transition-colors">
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  {asm.personas.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Personas</span>
                      {asm.personas.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-slate-400">
                          <span>{p.name}</span>
                          <span className="text-slate-600 text-[10px]">{p.capability_count} caps</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bindings table (FDU-10) */}
                {(asm.bindings ?? []).length > 0 && (
                  <div className="mt-1">
                    <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-2">Bindings</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-surface-border/40">
                            <th className="text-left pb-1.5 pr-3 text-[10px] text-slate-600 font-semibold">Capability</th>
                            <th className="text-left pb-1.5 pr-3 text-[10px] text-slate-600 font-semibold">Agent</th>
                            <th className="text-center pb-1.5 px-2 text-[10px] text-slate-600 font-semibold" title="Guardrails">
                              <Shield size={10} className="inline" />
                            </th>
                            <th className="text-center pb-1.5 px-2 text-[10px] text-slate-600 font-semibold" title="Observability">
                              <Eye size={10} className="inline" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(asm.bindings ?? []).map((b) => (
                            <tr key={b.capability_name} className="border-t border-surface-border/30">
                              <td className="py-1.5 pr-3 font-mono text-[11px] text-slate-300">{b.capability_name}</td>
                              <td className="py-1.5 pr-3 font-mono text-[11px]">
                                {b.agent ? (
                                  <Link to={`/agents/${b.agent.id}`}
                                    className="text-slate-400 hover:text-accent transition-colors">
                                    {b.agent_name}
                                  </Link>
                                ) : (
                                  <span className="text-slate-600">{b.agent_name ?? "unbound"}</span>
                                )}
                              </td>
                              <td className={`py-1.5 px-2 text-center text-[11px] font-mono ${flagColor(b.agent?.guardrails ?? null)}`}>
                                {flagLabel(b.agent?.guardrails ?? null)}
                              </td>
                              <td className={`py-1.5 px-2 text-center text-[11px] font-mono ${flagColor(b.agent?.observability ?? null)}`}>
                                {flagLabel(b.agent?.observability ?? null)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Dependencies (FDU-10) */}
                {(asm.dependencies ?? []).length > 0 && (
                  <div>
                    <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1.5">Dependencies</span>
                    <div className="flex flex-col gap-1">
                      {(asm.dependencies ?? []).map((d) => (
                        <div key={d.id} className="flex items-center gap-2 text-[11px]">
                          {d.required ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/20 border border-red-800/40 text-red-400 font-semibold">
                              required
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-surface-border/60 text-slate-600">
                              optional
                            </span>
                          )}
                          {d.url ? (
                            <a href={d.url} target="_blank" rel="noreferrer"
                              className="text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
                              <ExternalLink size={10} /> {d.name}
                            </a>
                          ) : (
                            <span className="text-slate-400">{d.name}</span>
                          )}
                          {d.description && (
                            <span className="text-slate-600">{d.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Governance heat map (FDU-13) */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                    Governance Matrix
                  </span>
                  <GovernanceMatrix assembly={asm} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Agents (FDU-12: flag chips + click-through) */}
      {toolkit.agents.length > 0 && (
        <Section title="Agents" count={toolkit.agents.length}>
          <div className="flex flex-col gap-3">
            {toolkit.agents.map((ag) => {
              const tools = parseList(ag.tools_used);
              const st = statsMap.get(ag.name);
              const dur = st?.avg_duration_ms != null
                ? st.avg_duration_ms >= 60000
                  ? `${(st.avg_duration_ms / 60000).toFixed(1)}m`
                  : `${(st.avg_duration_ms / 1000).toFixed(1)}s`
                : null;
              return (
                <div key={ag.id} id={`agent-${ag.id}`}
                  className="flex flex-col gap-2 border border-surface-border/60 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Link to={`/agents/${ag.id}`}
                      className="font-mono text-sm text-slate-200 flex items-center gap-2 hover:text-accent transition-colors">
                      <Bot size={14} className="text-accent" /> {ag.name}
                    </Link>
                    <div className="flex items-center gap-2 flex-wrap">
                      {ag.orchestrator  !== null && (
                        <span title="Orchestrator" className={`flex items-center gap-1 text-[10px] ${flagColor(ag.orchestrator)}`}>
                          <Network size={11} />{flagLabel(ag.orchestrator)}
                        </span>
                      )}
                      {ag.guardrails !== null && (
                        <span title="Guardrails" className={`flex items-center gap-1 text-[10px] ${flagColor(ag.guardrails)}`}>
                          <Shield size={11} />{flagLabel(ag.guardrails)}
                        </span>
                      )}
                      {ag.observability !== null && (
                        <span title="Observability" className={`flex items-center gap-1 text-[10px] ${flagColor(ag.observability)}`}>
                          <Eye size={11} />{flagLabel(ag.observability)}
                        </span>
                      )}
                      {st && (
                        <span className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="tabular-nums">{st.call_count.toLocaleString()} calls</span>
                          {st.avg_cost_usd != null && st.avg_cost_usd > 0 && (
                            <span className="tabular-nums text-slate-600">${st.avg_cost_usd.toFixed(4)} avg</span>
                          )}
                          {dur && <span className="tabular-nums text-slate-600">{dur} avg</span>}
                        </span>
                      )}
                      {ag.model && (
                        <span className="text-[10px] font-mono text-slate-600 bg-surface px-2 py-0.5 rounded border border-surface-border">
                          {ag.model}
                        </span>
                      )}
                    </div>
                  </div>
                  {ag.description && <p className="text-xs text-slate-500">{ag.description}</p>}
                  {tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {tools.map((tool) => (
                        <a key={tool} href={`#tool-${tool}`}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-surface-border text-slate-500 hover:border-accent hover:text-accent transition-colors">
                          {tool}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Tools */}
      {toolkit.tools.length > 0 && (
        <Section title="Tools" count={toolkit.tools.length}>
          <div className="flex flex-col gap-3">
            {toolkit.tools.map((t) => {
              const st = statsMap.get(t.name);
              const dur = st?.avg_duration_ms != null
                ? st.avg_duration_ms >= 60000
                  ? `${(st.avg_duration_ms / 60000).toFixed(1)}m`
                  : `${(st.avg_duration_ms / 1000).toFixed(1)}s`
                : null;
              return (
                <div key={t.id} id={`tool-${t.name}`}
                  className="flex flex-col gap-2 border border-surface-border/60 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench size={14} className="text-accent shrink-0" />
                      <span className="font-mono text-sm text-slate-200">{t.name}</span>
                    </div>
                    {st && (
                      <span className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span className="tabular-nums">{st.call_count.toLocaleString()} calls</span>
                        {dur && <span className="tabular-nums text-slate-600">{dur} avg</span>}
                      </span>
                    )}
                  </div>
                  {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
                  {t.output_description && (
                    <p className="text-[11px] text-slate-600 italic">{t.output_description}</p>
                  )}
                  {t.input_schema && (
                    <div className="mt-1">
                      <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Input Schema</span>
                      <pre className="mt-1 text-[10px] text-slate-500 bg-surface border border-surface-border rounded px-3 py-2 overflow-x-auto">
                        {JSON.stringify(t.input_schema, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Contributors */}
      {pushes.length > 0 && (() => {
        const seen = new Map<string, PushRecord>();
        pushes.forEach((p) => {
          const key = p.pusher_email || p.pusher_name || p.id;
          if (!seen.has(key)) seen.set(key, p);
        });
        const contributors = [...seen.values()];
        if (contributors.length <= 1) return null;
        return (
          <Section title="Contributors" count={contributors.length} defaultOpen={false}>
            <div className="flex flex-col gap-2">
              {contributors.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-[11px] px-3 py-2 border border-surface-border/60 rounded-lg">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Users size={12} className="text-slate-500 shrink-0" />
                    {p.pusher_name || p.pusher_email || "Unknown"}
                    {p.pusher_name && p.pusher_email && (
                      <span className="text-slate-600">&lt;{p.pusher_email}&gt;</span>
                    )}
                  </span>
                  <span className="text-slate-600">{new Date(p.pushed_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </Section>
        );
      })()}

      {/* Token usage with pivot (FDU-15) */}
      {toolkit.token_stats.length > 0 && (
        <Section title="Token Usage" count={toolkit.token_stats.length}>
          <TokenPivot tkId={toolkit.id} flatStats={toolkit.token_stats} />
        </Section>
      )}

      {/* Readiness checklist (FDU-16) */}
      <Section title="Readiness Checklist" count={checks.length} defaultOpen={false}>
        <div className="flex flex-col">
          {checks.map((c) => <ReadinessCheck key={c.label} check={c} />)}
        </div>
      </Section>
    </div>
  );
}
