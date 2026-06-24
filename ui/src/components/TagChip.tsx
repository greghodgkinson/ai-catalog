const PALETTES = [
  "bg-purple-950/60 text-purple-300 border-purple-800/60",
  "bg-blue-950/60 text-blue-300 border-blue-800/60",
  "bg-emerald-950/60 text-emerald-300 border-emerald-800/60",
  "bg-amber-950/60 text-amber-300 border-amber-800/60",
  "bg-rose-950/60 text-rose-300 border-rose-800/60",
  "bg-cyan-950/60 text-cyan-300 border-cyan-800/60",
  "bg-indigo-950/60 text-indigo-300 border-indigo-800/60",
  "bg-teal-950/60 text-teal-300 border-teal-800/60",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xfffff;
  return h;
}

interface Props {
  tag: string;
  size?: "sm" | "xs";
}

export function TagChip({ tag, size = "sm" }: Props) {
  const cls = PALETTES[hash(tag) % PALETTES.length];
  const text = size === "xs" ? "text-[10px] px-1.5 py-0" : "text-[11px] px-2 py-0.5";
  return (
    <span className={`inline-flex items-center border rounded-full font-medium ${cls} ${text}`}>
      {tag}
    </span>
  );
}
