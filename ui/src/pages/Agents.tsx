import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot } from "lucide-react";
import { api, Agent, parseList } from "../lib/api";
import { SearchBar } from "../components/SearchBar";

export function Agents() {
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [toolkitFilter, setToolkitFilter] = useState("");
  const [modelFilter, setModelFilter]     = useState("");

  useEffect(() => {
    api.agents().then(setAgents).finally(() => setLoading(false));
  }, []);

  const toolkits = useMemo(() => [...new Set(agents.map((a) => a.toolkit_name))].sort(), [agents]);
  const models   = useMemo(() => [...new Set(agents.map((a) => a.model).filter(Boolean))].sort() as string[], [agents]);

  const filtered = useMemo(() => {
    let list = agents;
    if (q) {
      const lq = q.toLowerCase();
      list = list.filter(
        (a) => a.name.toLowerCase().includes(lq) || a.description?.toLowerCase().includes(lq)
      );
    }
    if (toolkitFilter) list = list.filter((a) => a.toolkit_name === toolkitFilter);
    if (modelFilter)   list = list.filter((a) => a.model === modelFilter);
    return list;
  }, [agents, q, toolkitFilter, modelFilter]);

  const uniqueToolkits = new Set(agents.map((a) => a.toolkit_id)).size;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 flex flex-col gap-6">
      <div className="pt-4">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Bot size={18} className="text-accent" /> Agents
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {agents.length} agents across {uniqueToolkits} toolkits
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="max-w-sm flex-1">
          <SearchBar value={q} onChange={setQ} placeholder="Search agents…" />
        </div>
        <select value={toolkitFilter} onChange={(e) => setToolkitFilter(e.target.value)}
          className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-accent">
          <option value="">All toolkits</option>
          {toolkits.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}
          className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-accent">
          <option value="">All models</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-surface-raised border border-surface-border rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Agent</th>
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Toolkit</th>
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Model</th>
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Tools Used</th>
                <th className="text-left py-2.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const tools = parseList(a.tools_used);
                return (
                  <tr key={a.id} className="border-b border-surface-border/30 hover:bg-surface-raised/50 transition-colors">
                    <td className="py-3 pr-4 font-mono text-slate-200">{a.name}</td>
                    <td className="py-3 pr-4">
                      <Link to={`/toolkits/${a.toolkit_id}`} className="text-accent hover:text-accent-hover transition-colors">
                        {a.toolkit_name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-mono text-[10px] text-slate-500">{a.model ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {tools.slice(0, 3).map((t) => (
                          <span key={t} className="font-mono text-[10px] px-1.5 py-px rounded bg-surface border border-surface-border text-slate-500">
                            {t}
                          </span>
                        ))}
                        {tools.length > 3 && (
                          <span className="text-[10px] text-slate-600">+{tools.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-slate-500 max-w-xs truncate">{a.description ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-slate-600 py-10 text-sm">No agents match your filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
