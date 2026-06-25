import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bot, ChevronDown, ChevronRight, Crown, Download, ExternalLink,
  GitBranch, GitCommitHorizontal, Tag, User, Users, Wrench,
} from "lucide-react";
import { api, ToolkitDetail as TDetail, PushRecord, parseTags, parseList } from "../lib/api";
import { TagChip } from "../components/TagChip";

function Section({
  title, count, children,
}: { title: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
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

  const tags = parseTags(toolkit.tags);
  const hasGit = toolkit.git_branch || toolkit.git_last_commit;
  const tokenTotal = toolkit.token_stats.reduce((a, s) => a + s.call_count, 0);
  const costTotal  = toolkit.token_stats.reduce((a, s) => a + (s.total_cost_usd ?? 0), 0);
  const statsMap   = new Map(toolkit.token_stats.map((s) => [s.capability_name, s]));

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
          <button
            onClick={downloadSpec}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-surface-border text-slate-400 rounded-lg hover:border-accent hover:text-accent transition-colors"
          >
            <Download size={13} /> Download spec
          </button>
        </div>

        {toolkit.description && (
          <p className="text-sm text-slate-400 leading-relaxed">{toolkit.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => <TagChip key={tag} tag={tag} />)}
        </div>

        {/* Git provenance */}
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

      {/* Assemblies */}
      {toolkit.assemblies.length > 0 && (
        <Section title="Assemblies" count={toolkit.assemblies.length}>
          <div className="flex flex-col gap-4">
            {toolkit.assemblies.map((asm) => (
              <div key={asm.id} className="flex flex-col gap-3 border border-surface-border/60 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">{asm.name}</span>
                  {asm.gateway_port && (
                    <span className="font-mono text-[10px] text-slate-600 bg-surface px-2 py-0.5 rounded border border-surface-border">
                      :{asm.gateway_port}
                    </span>
                  )}
                </div>
                {asm.description && <p className="text-xs text-slate-500">{asm.description}</p>}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  {asm.consumers.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Consumers</span>
                      {asm.consumers.map((c) => (
                        <span key={c.id} className="block text-slate-400">{c.name}</span>
                      ))}
                    </div>
                  )}
                  {asm.personas.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider block mb-1">Personas</span>
                      {asm.personas.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-slate-400">
                          <span>{p.name}</span>
                          <span className="text-slate-600 text-[10px]">{p.capability_count} capabilities</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Agents */}
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
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-slate-200 flex items-center gap-2">
                      <Bot size={14} className="text-accent" /> {ag.name}
                    </span>
                    <div className="flex items-center gap-2">
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
        // De-dupe by pusher_email (or name if no email), keep only most-recent push per person
        const seen = new Map<string, PushRecord>();
        pushes.forEach((p) => {
          const key = p.pusher_email || p.pusher_name || p.id;
          if (!seen.has(key)) seen.set(key, p);
        });
        const contributors = [...seen.values()];
        if (contributors.length <= 1) return null;
        return (
          <Section title="Contributors" count={contributors.length}>
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

      {/* Token stats */}
      {toolkit.token_stats.length > 0 && (
        <Section title="Token Usage" count={toolkit.token_stats.length}>
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="text-left py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Capability</th>
                    <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Calls</th>
                    <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Avg Input</th>
                    <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Avg Output</th>
                    <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Avg Cost</th>
                    <th className="text-right py-2 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Avg Response</th>
                    <th className="text-right py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {toolkit.token_stats.map((s) => {
                    const isTool = s.capability_type === "tool";
                    const dur = s.avg_duration_ms != null
                      ? s.avg_duration_ms >= 60000
                        ? `${(s.avg_duration_ms / 60000).toFixed(1)}m`
                        : `${(s.avg_duration_ms / 1000).toFixed(1)}s`
                      : "—";
                    return (
                      <tr key={s.id} className="border-b border-surface-border/40 hover:bg-surface-hover/30 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-slate-300">
                          <span className="flex items-center gap-1.5">
                            {isTool
                              ? <Wrench size={11} className="text-slate-500 shrink-0" />
                              : <Bot size={11} className="text-accent shrink-0" />}
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
                        <td className="py-2.5 text-right text-slate-600 text-[10px]">{isTool ? <span className="text-slate-700">—</span> : (s.provider ?? "—")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-6 pt-2 border-t border-surface-border/50 text-[11px] text-slate-500">
              <span>Total calls: <b className="text-slate-300">{tokenTotal.toLocaleString()}</b></span>
              <span>Total cost: <b className="text-gold">${costTotal.toFixed(5)}</b></span>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
