const base = "/api/catalog";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Stats {
  toolkits: number;
  assemblies: number;
  consumers: number;
  personas: number;
  agents: number;
  tools: number;
  total_calls: number;
  total_cost_usd: number;
}

export interface ToolkitSummary {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  tags: string | null;  // comma-separated
  repo_url: string | null;
  git_branch: string | null;
  git_last_commit: string | null;
  git_is_dirty: number;  // 0/1
  first_published_at: string;
  last_published_at: string;
  agent_count: number;
  tool_count: number;
  consumer_count: number;
  persona_count: number;
  total_calls: number;
}

export interface Consumer {
  id: string;
  assembly_id: string;
  toolkit_id: string;
  name: string;
  description: string | null;
  toolkit_name: string;
}

export interface Persona {
  id: string;
  assembly_id: string;
  toolkit_id: string;
  name: string;
  description: string | null;
  capability_count: number;
  toolkit_name: string;
}

export interface Agent {
  id: string;
  toolkit_id: string;
  name: string;
  description: string | null;
  tools_used: string | null;  // comma-separated
  llm_class: string | null;
  model: string | null;
  toolkit_name: string;
}

export interface Tool {
  id: string;
  toolkit_id: string;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
  output_description: string | null;
  toolkit_name: string;
}

export interface AssemblyDetail {
  id: string;
  name: string;
  description: string | null;
  gateway_port: number | null;
  raw_yaml: string | null;
  published_at: string;
  consumers: Consumer[];
  personas: Persona[];
}

export interface TokenStat {
  id: string;
  toolkit_id: string;
  capability_name: string;
  call_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  avg_input_tokens: number | null;
  avg_output_tokens: number | null;
  avg_cost_usd: number | null;
  provider: string | null;
  last_updated_at: string;
}

export interface ToolkitDetail extends ToolkitSummary {
  assemblies: AssemblyDetail[];
  agents: Agent[];
  tools: Tool[];
  token_stats: TokenStat[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseTags(tags: string | null): string[] {
  return tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
}

export function parseList(s: string | null): string[] {
  return s ? s.split(",").map((t) => t.trim()).filter(Boolean) : [];
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  stats: () => req<Stats>("/stats"),
  toolkits: (q?: string) => req<ToolkitSummary[]>(`/toolkits${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  toolkit: (id: string) => req<ToolkitDetail>(`/toolkits/${id}`),
  spec: (id: string) => fetch(`${base}/toolkits/${id}/spec`),
  consumers: (q?: string, toolkit_id?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (toolkit_id) p.set("toolkit_id", toolkit_id);
    return req<Consumer[]>(`/consumers${p.size ? `?${p}` : ""}`);
  },
  personas: (q?: string, toolkit_id?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (toolkit_id) p.set("toolkit_id", toolkit_id);
    return req<Persona[]>(`/personas${p.size ? `?${p}` : ""}`);
  },
  agents: (q?: string, toolkit_id?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (toolkit_id) p.set("toolkit_id", toolkit_id);
    return req<Agent[]>(`/agents${p.size ? `?${p}` : ""}`);
  },
  tools: (q?: string, toolkit_id?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (toolkit_id) p.set("toolkit_id", toolkit_id);
    return req<Tool[]>(`/tools${p.size ? `?${p}` : ""}`);
  },
};
