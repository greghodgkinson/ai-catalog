import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Users, ChevronLeft, Shield, Eye, Network, AlertCircle } from "lucide-react";
import { api, ConsumerDetail as TConsumerDetail, flagColor, flagLabel } from "../lib/api";

export function ConsumerDetail() {
  const { id } = useParams<{ id: string }>();
  const [consumer, setConsumer] = useState<TConsumerDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.consumer(id)
      .then(setConsumer)
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

  if (error || !consumer) return (
    <div className="max-w-4xl mx-auto px-6 pt-24 text-center">
      <p className="text-red-400 text-sm">{error ?? "Consumer not found"}</p>
      <Link to="/consumers" className="text-accent text-xs mt-4 inline-block">← Back to Consumers</Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 flex flex-col gap-6">
      <div className="pt-4">
        <Link to="/consumers" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-3">
          <ChevronLeft size={12} /> Consumers
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Users size={18} className="text-accent" /> {consumer.name}
            </h1>
            {consumer.description && (
              <p className="text-sm text-slate-400 mt-1">{consumer.description}</p>
            )}
          </div>
          <Link to={`/toolkits/${consumer.toolkit_id}`}
            className="text-xs text-accent hover:text-accent-hover transition-colors shrink-0 mt-1">
            {consumer.toolkit_name}
          </Link>
        </div>
      </div>

      {!consumer.has_persona_data && (
        <div className="flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
          <AlertCircle size={14} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-400">
            No persona access data indexed yet. Re-publish from the workbench to see capability access.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-slate-300">
          Personas &amp; Capabilities
          <span className="ml-2 text-[10px] text-slate-600 font-normal">
            {consumer.personas.length} persona{consumer.personas.length !== 1 ? "s" : ""}
          </span>
        </h2>

        {consumer.personas.length === 0 ? (
          <p className="text-xs text-slate-600 py-4">No personas linked to this consumer.</p>
        ) : (
          consumer.personas.map((persona) => (
            <div key={persona.id}
              className="bg-surface-raised border border-surface-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-border/50 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-slate-200">{persona.name}</span>
                  {persona.description && (
                    <span className="ml-2 text-xs text-slate-500">{persona.description}</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-600">
                  {persona.capabilities.length} capability{persona.capabilities.length !== 1 ? "s" : ""}
                </span>
              </div>

              {persona.capabilities.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-600">No capabilities indexed.</p>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-surface-border/30">
                      <th className="text-left px-4 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Capability</th>
                      <th className="text-left px-4 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Agent</th>
                      <th className="text-left px-4 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Model</th>
                      <th className="text-center px-4 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                        <span title="Guardrails / Observability">G / O</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {persona.capabilities.map((cap) => {
                      const ag = cap.binding?.agent;
                      return (
                        <tr key={cap.capability_name}
                          className="border-b border-surface-border/20 hover:bg-surface/50 transition-colors">
                          <td className="px-4 py-2.5 font-mono text-slate-300">{cap.capability_name}</td>
                          <td className="px-4 py-2.5 text-slate-400">
                            {cap.binding?.agent_name ? (
                              <span className="font-mono text-[11px]">{cap.binding.agent_name}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">
                            {ag?.model ?? "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {ag ? (
                              <div className="flex gap-2 justify-center">
                                <span title="Guardrails" className={`flex items-center gap-0.5 ${flagColor(ag.guardrails)}`}>
                                  <Shield size={10} />{flagLabel(ag.guardrails)}
                                </span>
                                <span title="Observability" className={`flex items-center gap-0.5 ${flagColor(ag.observability)}`}>
                                  <Eye size={10} />{flagLabel(ag.observability)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-center block">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
