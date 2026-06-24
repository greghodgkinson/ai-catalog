import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, GitBranch, Layers, Users, Wrench } from "lucide-react";
import { api, Stats, ToolkitSummary, parseTags } from "../lib/api";
import { CountUp } from "../components/CountUp";
import { TagChip } from "../components/TagChip";

function StatHero({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 bg-surface-raised border border-surface-border rounded-2xl px-8 py-6 relative overflow-hidden group hover:border-accent/40 transition-colors">
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="text-accent/70">{icon}</div>
      <CountUp value={value} className="text-4xl font-black text-slate-100 tabular-nums" />
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function RecentCard({ t }: { t: ToolkitSummary }) {
  const tags = parseTags(t.tags);
  return (
    <Link
      to={`/toolkits/${t.id}`}
      className="flex flex-col gap-3 bg-surface-raised border border-surface-border rounded-xl p-5 hover:border-accent/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-slate-100 group-hover:text-accent transition-colors line-clamp-1">
          {t.name}
        </span>
        <ArrowRight size={14} className="text-slate-600 group-hover:text-accent transition-colors shrink-0 mt-0.5" />
      </div>
      {t.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2">{t.description}</p>
      )}
      <div className="flex items-center gap-3 text-[10px] text-slate-600">
        <span className="flex items-center gap-1"><Bot size={11} /> {t.agent_count}</span>
        <span className="flex items-center gap-1"><Wrench size={11} /> {t.tool_count}</span>
        <span className="flex items-center gap-1"><Users size={11} /> {t.consumer_count}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 3).map((tag) => <TagChip key={tag} tag={tag} size="xs" />)}
      </div>
      {t.owner && (
        <span className="text-[10px] text-slate-600">{t.owner}</span>
      )}
    </Link>
  );
}

export function Home() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [recent, setRecent]   = useState<ToolkitSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.stats(), api.toolkits()])
      .then(([s, ts]) => {
        setStats(s);
        setRecent(ts.slice(0, 6));
      })
      .finally(() => setLoading(false));
  }, []);

  const heroStats = stats
    ? [
        { label: "Toolkits",   value: stats.toolkits,   icon: <Layers size={20} /> },
        { label: "Assemblies", value: stats.assemblies, icon: <Layers size={20} /> },
        { label: "Agents",     value: stats.agents,     icon: <Bot size={20} /> },
        { label: "Tools",      value: stats.tools,      icon: <Wrench size={20} /> },
        { label: "Consumers",  value: stats.consumers,  icon: <Users size={20} /> },
        { label: "Personas",   value: stats.personas,   icon: <Users size={20} /> },
      ]
    : [];

  return (
    <div className="flex flex-col gap-16 pb-20">
      {/* Hero */}
      <section className="relative pt-24 pb-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/8 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col gap-3 mb-10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-accent uppercase tracking-widest">Prolifics Agentic Portfolio</span>
            </div>
            <h1 className="text-4xl font-black text-slate-100 leading-tight">
              The Agentic Advantage<br />
              <span className="text-accent">Catalog</span>
            </h1>
            <p className="text-base text-slate-400 max-w-xl">
              Every AI agent, tool, and assembly built at Prolifics — published, governed, and tracked in one place.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 bg-surface-raised border border-surface-border rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {heroStats.map((s) => (
                <StatHero key={s.label} {...s} />
              ))}
            </div>
          )}

          {stats && (stats.total_calls > 0 || stats.total_cost_usd > 0) && (
            <div className="flex gap-6 mt-6">
              <div className="flex flex-col gap-0.5">
                <span className="text-2xl font-bold text-slate-100 tabular-nums">
                  {stats.total_calls.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 uppercase tracking-wider">Total AI Capability Calls</span>
              </div>
              <div className="w-px bg-surface-border" />
              <div className="flex flex-col gap-0.5">
                <span className="text-2xl font-bold text-gold tabular-nums">
                  ${stats.total_cost_usd.toFixed(4)}
                </span>
                <span className="text-[11px] text-slate-500 uppercase tracking-wider">Estimated Total Cost</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Recently updated */}
      {recent.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 w-full">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Recently Published</h2>
            <Link to="/toolkits" className="text-[11px] text-accent hover:text-accent-hover flex items-center gap-1">
              All toolkits <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recent.map((t) => <RecentCard key={t.id} t={t} />)}
          </div>
        </section>
      )}

      {/* Toolkit timeline */}
      {recent.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 w-full">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-5">Publication Timeline</h2>
          <div className="relative">
            <div className="absolute top-4 left-0 right-0 h-px bg-surface-border" />
            <div className="flex gap-6 overflow-x-auto pb-2">
              {[...recent].reverse().map((t) => (
                <Link key={t.id} to={`/toolkits/${t.id}`} className="flex flex-col items-center gap-2 min-w-[100px] group">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent border-2 border-surface relative z-10 group-hover:scale-125 transition-transform" />
                  <span className="text-[10px] text-slate-500 text-center group-hover:text-slate-300 transition-colors">
                    {new Date(t.first_published_at).toLocaleDateString("en", { month: "short", day: "numeric" })}
                  </span>
                  <span className="text-[11px] text-slate-400 text-center leading-tight group-hover:text-accent transition-colors line-clamp-2 font-medium">
                    {t.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Git overview strip */}
      {recent.filter((t) => t.git_branch).length > 0 && (
        <section className="max-w-7xl mx-auto px-6 w-full">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Git Branches</h2>
          <div className="flex flex-wrap gap-3">
            {recent.filter((t) => t.git_branch).map((t) => (
              <Link key={t.id} to={`/toolkits/${t.id}`} className="flex items-center gap-2 px-3 py-2 bg-surface-raised border border-surface-border rounded-lg text-[11px] hover:border-accent/40 transition-colors">
                <GitBranch size={12} className="text-slate-500" />
                <span className="font-mono text-slate-400">{t.git_branch}</span>
                <span className="text-slate-600">—</span>
                <span className="text-slate-500">{t.name}</span>
                {Boolean(t.git_is_dirty) && (
                  <span className="px-1 py-px rounded text-[9px] bg-amber-950/60 border border-amber-800 text-amber-400">dirty</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && recent.length === 0 && (
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center gap-4 py-24 text-slate-600">
          <Layers size={48} strokeWidth={1} />
          <p className="text-sm">No toolkits published yet.</p>
          <p className="text-xs">Use the Toolkit Workbench to push your first toolkit to this catalog.</p>
        </div>
      )}
    </div>
  );
}
