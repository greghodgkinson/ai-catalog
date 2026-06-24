import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search…" }: Props) {
  return (
    <div className="relative">
      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface border border-surface-border rounded-lg pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
