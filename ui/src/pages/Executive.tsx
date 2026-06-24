import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { api, Stats, ToolkitSummary, Agent, Tool, parseTags } from "../lib/api";
import { CountUp } from "../components/CountUp";

interface CapabilityRank {
  name: string;
  toolkit_name: string;
  toolkit_id: string;
  call_count: number;
}

interface ProviderStat {
  provider: string;
  calls: number;
}

function ExecTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex flex-col gap-3 bg-white/5 border border-white/10 rounded-2xl px-8 py-7 print:bg-gray-50 print:text-black print:border-gray-200">
      <span className="text-[11px] font-bold uppercase tracking-widest text-white/40 print:text-gray-500">{label}</span>
      <div className="text-5xl font-black text-white print:text-gray-900">{value}</div>
      {sub && <span className="text-sm text-white/40 print:text-gray-500">{sub}</span>}
    </div>
  );
}

export function Executive() {
  const [stats, setStats]         = useState<Stats | null>(null);
  const [toolkits, setToolkits]   = useState<ToolkitSummary[]>([]);
  const [agents, setAgents]       = useState<Agent[]>([]);
  const [tools, setTools]         = useState<Tool[]>([]);
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    Promise.all([api.stats(), api.toolkits(), api.agents(), api.tools()])
      .then(([s, tk, ag, tl]) => { setStats(s); setToolkits(tk); setAgents(ag); setTools(tl); })
      .finally(() => setLoading(false));
  }, []);

  // Top capabilities by call_count — pulled from toolkit detail would require N+1;
  // approximate with per-toolkit totals from summary
  const topToolkits = useMemo(
    () => [...toolkits].sort((a, b) => (b.total_calls ?? 0) - (a.total_calls ?? 0)).slice(0, 10),
    [toolkits]
  );

  // Tag domain breakdown
  const tagDomain = useMemo(() => {
    const map: Record<string, number> = {};
    toolkits.forEach((t) => {
      parseTags(t.tags).forEach((tag) => { map[tag] = (map[tag] ?? 0) + 1; });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [toolkits]);

  const maxTagCount = tagDomain[0]?.[1] ?? 1;

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/30" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white print:bg-white print:text-black">
      {/* Controls (hidden on print) */}
      <div className="no-print fixed top-4 left-4 right-4 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
          <ArrowLeft size={13} /> Back to Catalog
        </Link>
        <button onClick={copyUrl}
          className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
          {copied ? "Copied!" : <><Copy size={13} /> Share</>}
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-20 flex flex-col gap-16">

        {/* Header */}
        <div className="flex flex-col gap-4 pt-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/30 print:text-gray-500">
            Prolifics — Agentic Advantage Programme
          </p>
          <h1 className="text-5xl font-black leading-tight">
            AI Portfolio<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 print:text-indigo-600">
              Executive Summary
            </span>
          </h1>
          <p className="text-lg text-white/40 print:text-gray-500 max-w-xl">
            A live view of every AI agent, tool, and assembly built at Prolifics — tracking our progress on the agentic advantage journey.
          </p>
        </div>

        {/* Portfolio stats */}
        {stats && (
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-6 print:text-gray-500">
              Portfolio at a Glance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ExecTile label="Toolkits Deployed"   value={<CountUp value={stats.toolkits} />} />
              <ExecTile label="Agents Built"         value={<CountUp value={stats.agents} />} />
              <ExecTile label="Tools Available"      value={<CountUp value={stats.tools} />} />
              <ExecTile label="Consumers Served"     value={<CountUp value={stats.consumers} />} />
              <ExecTile label="Total AI Calls"       value={<CountUp value={stats.total_calls} />} sub="capability invocations across all deployments" />
              <ExecTile
                label="Estimated AI Cost"
                value={`$${stats.total_cost_usd.toFixed(4)}`}
                sub="Cost-savings methodology TBD"
              />
            </div>
          </section>
        )}

        {/* Journey timeline */}
        {toolkits.length > 0 && (
          <section className="print-break">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-8 print:text-gray-500">
              Delivery Timeline
            </h2>
            <div className="relative pl-4">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-white/10 print:bg-gray-200" />
              {[...toolkits]
                .sort((a, b) => new Date(a.first_published_at).getTime() - new Date(b.first_published_at).getTime())
                .map((t) => (
                  <div key={t.id} className="flex items-start gap-4 mb-6 relative">
                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-[#0a0d14] print:border-white" />
                    <div className="pl-4">
                      <span className="text-[10px] text-white/30 font-mono print:text-gray-400">
                        {new Date(t.first_published_at).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-white print:text-gray-900">{t.name}</span>
                        <ExternalLink size={11} className="text-white/20 no-print" />
                      </div>
                      {t.owner && <p className="text-xs text-white/30 print:text-gray-500">{t.owner}</p>}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Domain coverage */}
        {tagDomain.length > 0 && (
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-6 print:text-gray-500">
              Coverage by Domain
            </h2>
            <div className="flex flex-col gap-3">
              {tagDomain.map(([tag, count]) => (
                <div key={tag} className="flex items-center gap-4">
                  <span className="w-28 text-sm text-white/60 shrink-0 print:text-gray-600 capitalize">{tag}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-2 print:bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 print:bg-indigo-500 transition-all"
                      style={{ width: `${(count / maxTagCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-white w-6 text-right print:text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top toolkits by usage */}
        {topToolkits.filter((t) => t.total_calls > 0).length > 0 && (
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-6 print:text-gray-500">
              Most Active Toolkits
            </h2>
            <div className="flex flex-col gap-2">
              {topToolkits.filter((t) => t.total_calls > 0).map((t, i) => (
                <div key={t.id} className="flex items-center gap-4 py-3 border-b border-white/5 print:border-gray-100">
                  <span className="w-5 text-right text-white/20 text-sm tabular-nums print:text-gray-400">{i + 1}</span>
                  <span className="flex-1 font-medium text-white print:text-gray-900">{t.name}</span>
                  <span className="tabular-nums text-sm text-white/60 print:text-gray-600">
                    {t.total_calls.toLocaleString()} calls
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Agents + Tools summary */}
        <section className="grid grid-cols-2 gap-8">
          {agents.length > 0 && (
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-4 print:text-gray-500">
                Agent Inventory
              </h2>
              <div className="flex flex-col gap-1">
                {agents.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm py-1.5 border-b border-white/5 print:border-gray-100">
                    <span className="text-white/70 font-mono print:text-gray-700">{a.name}</span>
                    {a.model && <span className="text-[10px] text-white/30 print:text-gray-400">{a.model}</span>}
                  </div>
                ))}
                {agents.length > 10 && (
                  <p className="text-xs text-white/30 pt-1 print:text-gray-400">+{agents.length - 10} more</p>
                )}
              </div>
            </div>
          )}
          {tools.length > 0 && (
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-4 print:text-gray-500">
                Tool Inventory
              </h2>
              <div className="flex flex-col gap-1">
                {tools.slice(0, 10).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-white/5 print:border-gray-100">
                    <span className="text-white/70 font-mono print:text-gray-700">{t.name}</span>
                  </div>
                ))}
                {tools.length > 10 && (
                  <p className="text-xs text-white/30 pt-1 print:text-gray-400">+{tools.length - 10} more</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-[10px] text-white/20 border-t border-white/10 pt-6 print:text-gray-400 print:border-gray-200">
          Prolifics AI Catalog · Generated {new Date().toLocaleDateString("en", { dateStyle: "long" })} · Data live from toolkit-workbench pushes
        </footer>
      </div>
    </div>
  );
}
