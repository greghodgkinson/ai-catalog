import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { api, Tool } from "../lib/api";
import { SearchBar } from "../components/SearchBar";

function SchemaCell({ schema }: { schema: Tool["input_schema"] }) {
  const [open, setOpen] = useState(false);
  if (!schema) return <span className="text-slate-600">—</span>;
  const props = (schema as { properties?: Record<string, unknown> }).properties ?? {};
  const keys  = Object.keys(props);
  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {keys.length} field{keys.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <pre className="mt-1 text-[10px] text-slate-500 bg-surface border border-surface-border rounded px-2 py-1 max-w-xs overflow-x-auto">
          {JSON.stringify(schema, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function Tools() {
  const [tools, setTools]     = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [toolkitFilter, setToolkitFilter] = useState("");

  useEffect(() => {
    api.tools().then(setTools).finally(() => setLoading(false));
  }, []);

  const toolkits = useMemo(() => [...new Set(tools.map((t) => t.toolkit_name))].sort(), [tools]);

  const filtered = useMemo(() => {
    let list = tools;
    if (q) {
      const lq = q.toLowerCase();
      list = list.filter(
        (t) => t.name.toLowerCase().includes(lq) || t.description?.toLowerCase().includes(lq)
      );
    }
    if (toolkitFilter) list = list.filter((t) => t.toolkit_name === toolkitFilter);
    return list;
  }, [tools, q, toolkitFilter]);

  const uniqueToolkits = new Set(tools.map((t) => t.toolkit_id)).size;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 flex flex-col gap-6">
      <div className="pt-4">
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Wrench size={18} className="text-accent" /> Tools
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {tools.length} tools across {uniqueToolkits} toolkits
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="max-w-sm flex-1">
          <SearchBar value={q} onChange={setQ} placeholder="Search tools…" />
        </div>
        <select value={toolkitFilter} onChange={(e) => setToolkitFilter(e.target.value)}
          className="bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-accent">
          <option value="">All toolkits</option>
          {toolkits.map((t) => <option key={t} value={t}>{t}</option>)}
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
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Tool</th>
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Toolkit</th>
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                <th className="text-left py-2.5 pr-4 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Input Schema</th>
                <th className="text-left py-2.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">Output</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-surface-border/30 hover:bg-surface-raised/50 transition-colors">
                  <td className="py-3 pr-4 font-mono text-slate-200">{t.name}</td>
                  <td className="py-3 pr-4">
                    <Link to={`/toolkits/${t.toolkit_id}`} className="text-accent hover:text-accent-hover transition-colors">
                      {t.toolkit_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-slate-500 max-w-xs">{t.description ?? "—"}</td>
                  <td className="py-3 pr-4"><SchemaCell schema={t.input_schema} /></td>
                  <td className="py-3 text-slate-500 max-w-xs truncate text-[10px]">{t.output_description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center text-slate-600 py-10 text-sm">No tools match your filters.</p>
          )}
        </div>
      )}
    </div>
  );
}
