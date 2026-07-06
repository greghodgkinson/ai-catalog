import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Bot, ChevronLeft, Shield, Eye, Network, Clock, Wrench, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { api, AgentDetail as TAgentDetail, flagColor, flagLabel } from "../lib/api";

function FlagChip({ label, icon: Icon, value }: { label: string; icon: React.ElementType; value: boolean | null }) {
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium ${
      value === true
        ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-400"
        : value === false
          ? "border-red-700/50 bg-red-900/20 text-red-400"
          : "border-surface-border bg-surface text-slate-600"
    }`}>
      <Icon size={11} />
      <span>{label}</span>
      <span className="font-mono">{flagLabel(value)}</span>
    </div>
  );
}

function ImpactTrace({ agent }: { agent: TAgentDetail }) {
  const [open, setOpen] = useState(true);

  if (!agent.has_impact_data) return (
    <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
      <AlertCircle size={14} className="text-amber-500 shrink-0" />
      <p className="text-xs text-amber-400">
        No access data indexed yet. Re-publish from the workbench to see consumer impact.
      </p>
    </div>
  );

  return (
    <div className="bg-surface-raised border border-surface-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
        <span className="text-sm font-semibold text-slate-300">
          Consumer Impact Trace
          <span className="ml-2 text-[10px] text-slate-600 font-normal">
            {agent.impact_trace.length} assembl{agent.impact_trace.length !== 1 ? "ies" : "y"}
          </span>
        </span>
        {open ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
      </button>

      {open && (
        <div className="border-t border-surface-border/50 divide-y divide-surface-border/30">
          {agent.impact_trace.map((entry) => (
            <div key={entry.assembly_name} className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-400 mb-2">{entry.assembly_name}</p>
              {entry.bindings.map((b) => (
                <div key={b.capability_name} className="ml-3 mb-3 last:mb-0">
                  <p className="font-mono text-[11px] text-slate-300 mb-1">→ {b.capability_name}</p>
                  {b.personas.map((p) => (
                    <div key={p.persona_name} className="ml-3">
                      <p className="text-[11px] text-slate-500">via persona: <span className="text-slate-400">{p.persona_name}</span></p>
                      <div className="flex flex-wrap gap-1 mt-1 ml-2">
                        {p.consumers.map((c) => (
                          <span key={c} className="text-[10px] px-1.5 py-px rounded bg-surface border border-surface-border text-slate-400">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<TAgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.agent(id)
      .then(setAgent)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 flex flex-col gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 bg-surface-raised border border-surface-border rounded-lg animate-pulse" />
      ))}
    </div>
  );

  if (error || !agent) return (
    <div className="max-w-4xl mx-auto px-6 pt-24 text-center">
      <p className="text-red-400 text-sm">{error ?? "Agent not found"}</p>
      <Link to="/agents" className="text-accent text-xs mt-4 inline-block">← Back to Agents</Link>
    </div>
  );

  const toolsList = Array.isArray(agent.tools_used) ? agent.tools_used : [];

  return (
    <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 flex flex-col gap-6">
      <div className="pt-4">
        <Link to="/agents" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3">
          <ChevronLeft size={12} /> Agents
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-mono">
              <Bot size={18} className="text-accent" /> {agent.name}
            </h1>
            {agent.description && (
              <p className="text-sm text-slate-400 mt-1">{agent.description}</p>
            )}
          </div>
          <Link to={`/toolkits/${agent.toolkit_id}`}
            className="text-xs text-accent hover:text-accent-hover transition-colors shrink-0 mt-1">
            {agent.toolkit_name}
          </Link>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-3 items-center">
        {agent.model && (
          <span className="font-mono text-[11px] px-2 py-1 bg-surface border border-surface-border rounded text-slate-400">
            {agent.model}
          </span>
        )}
        {agent.llm_class && (
          <span className="text-[11px] px-2 py-1 bg-surface border border-surface-border rounded text-slate-500">
            {agent.llm_class}
          </span>
        )}
        {agent.max_tokens != null && (
          <span className="flex items-center gap-1 text-[11px] px-2 py-1 bg-surface border border-surface-border rounded text-slate-500">
            <Clock size={10} /> max {agent.max_tokens.toLocaleString()} tokens
          </span>
        )}
      </div>

      {/* Flags */}
      {(agent.orchestrator !== null || agent.guardrails !== null || agent.observability !== null || agent.session_history !== null) && (
        <div className="flex flex-wrap gap-2">
          {agent.orchestrator    !== null && <FlagChip label="Orchestrator"   icon={Network} value={agent.orchestrator} />}
          {agent.guardrails      !== null && <FlagChip label="Guardrails"     icon={Shield}  value={agent.guardrails} />}
          {agent.observability   !== null && <FlagChip label="Observability"  icon={Eye}     value={agent.observability} />}
          {agent.session_history !== null && (
            <FlagChip label="Session History" icon={Clock} value={agent.session_history} />
          )}
        </div>
      )}

      {/* Tools */}
      {toolsList.length > 0 && (
        <div className="bg-surface-raised border border-surface-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border/50">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Wrench size={14} className="text-slate-500" />
              Tools Used
              <span className="text-[10px] text-slate-600 font-normal">{toolsList.length}</span>
            </h2>
          </div>
          <div className="divide-y divide-surface-border/30">
            {toolsList.map((t) => (
              <div key={t.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[12px] text-slate-200">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                    )}
                  </div>
                  {t.output_description && (
                    <p className="text-[10px] text-slate-600 text-right max-w-xs">{t.output_description}</p>
                  )}
                </div>
                {t.input_schema && (
                  <div className="mt-2">
                    <pre className="text-[10px] bg-surface rounded p-2 overflow-x-auto text-slate-400 border border-surface-border">
                      {JSON.stringify(t.input_schema, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Impact trace */}
      <ImpactTrace agent={agent} />
    </div>
  );
}
