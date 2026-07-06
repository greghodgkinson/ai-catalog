import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Shield, Eye, Network } from "lucide-react";
import { api, Agent, flagColor, flagLabel, parseList } from "../lib/api";
import { SearchBar } from "../components/SearchBar";

type FlagFilter = "all" | "true" | "false";

export function Agents() {
  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [toolkitFilter, setToolkitFilter]       = useState("");
  const [modelFilter, setModelFilter]           = useState("");
  const [orchestratorF, setOrchestratorF]       = useState<FlagFilter>("all");
  const [guardrailsF, setGuardrailsF]           = useState<FlagFilter>("all");
  const [observabilityF, setObservabilityF]     = useState<FlagFilter>("all");

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
    if (orchestratorF !== "all")   list = list.filter((a) => String(a.orchestrator)   === orchestratorF);
    if (guardrailsF !== "all")     list = list.filter((a) => String(a.guardrails)     === guardrailsF);
    if (observabilityF !== "all")  list = list.filter((a) => String(a.observability)  === observabilityF);
    return list;
  }, [agents, q, toolkitFilter, modelFilter, orchestratorF, guardrailsF, observabilityF]);

  const uniqueToolkits = new Set(agents.map((a) => a.toolkit_id)).size;
  const hasFlags = agents.some((a) => a.orchestrator !== null || a.guardrails !== null || a.observability !== null);

  const FlagSelect = ({ label, icon: Icon, value, onChange }: {
    label: string; icon: React.ElementType; value: FlagFilter; onChange: (v: FlagFilter) => void;
  }) => (
    <div className="flex items-center gap-1.5">
      <Icon size={12} className="text-slate-500" />
      <select value={value} onChange={(e) => onChange(e.target.value as FlagFilter)}
        className="bg-surface border border-surface-border rounded-lg px-2 py-2 text-xs text-slate-300 focus:outline-none focus:border-accent">
        <option value="all">{label}: all</option>
        <option value="true">{label}: on</option>
        <option value="false">{label}: off</option>
      </select>
    </div>
  );

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
        {hasFlags && (
          <>
            <FlagSelect label="Orchestrator" icon={Network}    value={orchestratorF}  onChange={setOrchestratorF} />
            <FlagSelect label="Guardrails"   icon={Shield}     value={guardrailsF}    onChange={setGuardrailsF} />
            <FlagSelect label="Observability" icon={Eye}       value={observabilityF} onChange={setObservabilityF} />
          </>
        )}
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
                {hasFlags && (
                  <th className="text-center py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                    Flags
                  </th>
                )}
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Tools Used</th>
                <th className="text-left py-2.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const tools = parseList(a.tools_used);
                return (
                  <tr key={a.id} className="border-b border-surface-border/30 hover:bg-surface-raised/50 transition-colors">
                    <td className="py-3 pr-4">
                      <Link to={`/agents/${a.id}`} className="font-mono text-slate-200 hover:text-accent transition-colors">
                        {a.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">
                      <Link to={`/toolkits/${a.toolkit_id}`} className="text-accent hover:text-accent-hover transition-colors">
                        {a.toolkit_name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-mono text-[10px] text-slate-500">{a.model ?? "—"}</td>
                    {hasFlags && (
                      <td className="py-3 pr-4">
                        <div className="flex gap-2 justify-center">
                          <span title="Orchestrator" className={`text-[11px] font-mono ${flagColor(a.orchestrator)}`}>
                            O:{flagLabel(a.orchestrator)}
                          </span>
                          <span title="Guardrails" className={`text-[11px] font-mono ${flagColor(a.guardrails)}`}>
                            G:{flagLabel(a.guardrails)}
                          </span>
                          <span title="Observability" className={`text-[11px] font-mono ${flagColor(a.observability)}`}>
                            V:{flagLabel(a.observability)}
                          </span>
                        </div>
                      </td>
                    )}
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
