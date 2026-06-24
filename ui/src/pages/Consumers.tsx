import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { api, Consumer, Persona } from "../lib/api";
import { SearchBar } from "../components/SearchBar";

type Tab = "consumers" | "personas";

export function Consumers() {
  const [tab, setTab]             = useState<Tab>("consumers");
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [personas, setPersonas]   = useState<Persona[]>([]);
  const [loading, setLoading]     = useState(true);
  const [q, setQ]                 = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([api.consumers(), api.personas()])
      .then(([c, p]) => { setConsumers(c); setPersonas(p); })
      .finally(() => setLoading(false));
  }, []);

  const filteredConsumers = useMemo(() => {
    if (!q) return consumers;
    const lq = q.toLowerCase();
    return consumers.filter(
      (c) => c.name.toLowerCase().includes(lq) || c.toolkit_name.toLowerCase().includes(lq)
    );
  }, [consumers, q]);

  const filteredPersonas = useMemo(() => {
    if (!q) return personas;
    const lq = q.toLowerCase();
    return personas.filter(
      (p) => p.name.toLowerCase().includes(lq) || p.toolkit_name.toLowerCase().includes(lq)
    );
  }, [personas, q]);

  const uniqueConsumerToolkits = new Set(consumers.map((c) => c.toolkit_id)).size;
  const uniquePersonaToolkits  = new Set(personas.map((p) => p.toolkit_id)).size;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 flex flex-col gap-6">
      <div className="pt-4">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Users size={18} className="text-accent" /> Consumers &amp; Personas
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-border">
        {(["consumers", "personas"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t}
            <span className="ml-2 text-[10px] opacity-60">
              {t === "consumers" ? consumers.length : personas.length}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <div className="max-w-sm flex-1">
          <SearchBar value={q} onChange={setQ} placeholder={`Search ${tab}…`} />
        </div>
        <p className="text-[11px] text-slate-500">
          {tab === "consumers"
            ? `${consumers.length} consumers across ${uniqueConsumerToolkits} toolkits`
            : `${personas.length} personas across ${uniquePersonaToolkits} toolkits`}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-surface-raised border border-surface-border rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tab === "consumers" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Consumer</th>
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Toolkit</th>
                <th className="text-left py-2.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredConsumers.map((c) => (
                <tr key={c.id} className="border-b border-surface-border/30 hover:bg-surface-raised/50 transition-colors">
                  <td className="py-3 pr-4 text-slate-200 font-medium">{c.name}</td>
                  <td className="py-3 pr-4">
                    <Link to={`/toolkits/${c.toolkit_id}`}
                      className="text-accent hover:text-accent-hover transition-colors">
                      {c.toolkit_name}
                    </Link>
                  </td>
                  <td className="py-3 text-slate-500">{c.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredConsumers.length === 0 && (
            <p className="text-center text-slate-600 py-10 text-sm">No consumers match.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Persona</th>
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Toolkit</th>
                <th className="text-right py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Capabilities</th>
                <th className="text-left py-2.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredPersonas.map((p) => (
                <tr key={p.id} className="border-b border-surface-border/30 hover:bg-surface-raised/50 transition-colors">
                  <td className="py-3 pr-4 text-slate-200 font-medium">{p.name}</td>
                  <td className="py-3 pr-4">
                    <Link to={`/toolkits/${p.toolkit_id}`}
                      className="text-accent hover:text-accent-hover transition-colors">
                      {p.toolkit_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-slate-400">{p.capability_count}</td>
                  <td className="py-3 text-slate-500">{p.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPersonas.length === 0 && (
            <p className="text-center text-slate-600 py-10 text-sm">No personas match.</p>
          )}
        </div>
      )}
    </div>
  );
}
