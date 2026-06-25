import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bot, GitBranch, Layers, Users, Wrench } from "lucide-react";
import { api, ToolkitSummary, parseTags } from "../lib/api";
import { SearchBar } from "../components/SearchBar";
import { TagChip } from "../components/TagChip";

type SortKey = "recent" | "name" | "agents";

function ToolkitCard({ t }: { t: ToolkitSummary }) {
  const tags = parseTags(t.tags);
  return (
    <Link
      to={`/toolkits/${t.id}`}
      className="flex flex-col gap-4 bg-surface-raised border border-surface-border rounded-xl p-5 hover:border-accent/40 hover:-translate-y-0.5 transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-semibold text-slate-100 group-hover:text-accent transition-colors line-clamp-1">
            {t.name}
          </span>
          {(t.owner_name || t.owner) && (
            <span className="text-[10px] text-slate-600">
              {t.owner_name || t.owner}
            </span>
          )}
        </div>
        <ArrowRight size={14} className="text-slate-600 group-hover:text-accent transition-colors shrink-0 mt-0.5" />
      </div>

      {t.description && (
        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{t.description}</p>
      )}

      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => <TagChip key={tag} tag={tag} size="xs" />)}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-slate-600 border-t border-surface-border/50 pt-3">
        <span className="flex items-center gap-1.5"><Bot size={12} /> <b className="text-slate-400">{t.agent_count}</b> agents</span>
        <span className="flex items-center gap-1.5"><Wrench size={12} /> <b className="text-slate-400">{t.tool_count}</b> tools</span>
        <span className="flex items-center gap-1.5"><Users size={12} /> <b className="text-slate-400">{t.consumer_count}</b></span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-600">
        {t.git_branch && (
          <span className="flex items-center gap-1 font-mono">
            <GitBranch size={10} /> {t.git_branch}
            {Boolean(t.git_is_dirty) && (
              <span className="ml-1 px-1 rounded bg-amber-950/60 border border-amber-800 text-amber-400">⚠</span>
            )}
          </span>
        )}
        <span className="ml-auto">{new Date(t.last_published_at).toLocaleDateString()}</span>
      </div>
    </Link>
  );
}

export function Toolkits() {
  const [toolkits, setToolkits] = useState<ToolkitSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState("");
  const [sort, setSort]         = useState<SortKey>("recent");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.toolkits().then(setToolkits).finally(() => setLoading(false));
  }, []);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    toolkits.forEach((t) => parseTags(t.tags).forEach((tag) => set.add(tag)));
    return [...set].sort();
  }, [toolkits]);

  const filtered = useMemo(() => {
    let list = toolkits;
    if (q) {
      const lower = q.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(lower) ||
          t.description?.toLowerCase().includes(lower) ||
          parseTags(t.tags).some((tag) => tag.toLowerCase().includes(lower))
      );
    }
    if (activeTags.size > 0) {
      list = list.filter((t) => parseTags(t.tags).some((tag) => activeTags.has(tag)));
    }
    return [...list].sort(
      sort === "name"   ? (a, b) => a.name.localeCompare(b.name)
      : sort === "agents" ? (a, b) => b.agent_count - a.agent_count
      : (a, b) => new Date(b.last_published_at).getTime() - new Date(a.last_published_at).getTime()
    );
  }, [toolkits, q, sort, activeTags]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 flex flex-col gap-6">
      <div className="flex items-center justify-between pt-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers size={18} className="text-accent" /> Toolkits
          </h1>
          <p className="text-xs text-slate-500 mt-1">{toolkits.length} published</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 items-center">
          <div className="flex-1 max-w-sm">
            <SearchBar value={q} onChange={setQ} placeholder="Search toolkits…" />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-accent"
          >
            <option value="recent">Most recent</option>
            <option value="name">Name A–Z</option>
            <option value="agents">Most agents</option>
          </select>
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  activeTags.has(tag)
                    ? "bg-accent/20 border-accent text-accent"
                    : "border-surface-border text-slate-500 hover:border-slate-500"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 bg-surface-raised border border-surface-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-slate-600">
          <Layers size={36} strokeWidth={1} />
          <p className="text-sm">{q || activeTags.size > 0 ? "No toolkits match your filters." : "No toolkits published yet."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => <ToolkitCard key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}
