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
  tags: string | null;
  repo_url: string | null;
  git_branch: string | null;
  git_last_commit: string | null;
  git_is_dirty: number;
  first_published_at: string;
  last_published_at: string;
  agent_count: number;
  tool_count: number;
  consumer_count: number;
  persona_count: number;
  total_calls: number;
  publisher_name: string | null;
  publisher_email: string | null;
  owner_name: string | null;
  owner_email: string | null;
}

export interface PushRecord {
  id: string;
  toolkit_id: string;
  pushed_at: string;
  pusher_name: string | null;
  pusher_email: string | null;
  git_branch: string | null;
  git_last_commit: string | null;
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

export interface AgentFlags {
  orchestrator: boolean | null;
  session_history: boolean | null;
  guardrails: boolean | null;
  observability: boolean | null;
}

export interface Agent extends AgentFlags {
  id: string;
  toolkit_id: string;
  name: string;
  description: string | null;
  tools_used: string | null;  // comma-separated in list view
  llm_class: string | null;
  model: string | null;
  max_tokens: number | null;
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

export interface BindingAgentRef {
  id: string;
  name: string;
  model: string | null;
  llm_class: string | null;
  orchestrator: boolean | null;
  guardrails: boolean | null;
  observability: boolean | null;
}

export interface Binding {
  capability_name: string;
  description: string | null;
  agent_name: string | null;
  agent: BindingAgentRef | null;
}

export interface Dependency {
  id: string;
  assembly_id: string;
  name: string;
  url: string | null;
  required: number;
  description: string | null;
}

export interface AssemblyDetail {
  id: string;
  name: string;
  description: string | null;
  gateway_port: number | null;
  raw_yaml: string | null;
  published_at: string;
  version: string | null;
  base_url: string | null;
  consumers: Consumer[];
  personas: Persona[];
  bindings: Binding[];
  dependencies: Dependency[];
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
  avg_duration_ms: number | null;
  provider: string | null;
  capability_type: string | null;
  last_updated_at: string;
}

export interface CapabilityTokenStat {
  capability_name: string;
  call_count: number;
  total_cost_usd: number;
  avg_cost_usd: number | null;
  avg_duration_ms: number | null;
  provider: string | null;
  capability_type: string | null;
}

export interface PersonaTokenGroup {
  persona_id: string;
  persona_name: string;
  total_calls: number;
  total_cost_usd: number;
  capabilities: CapabilityTokenStat[];
}

export interface ConsumerTokenGroup {
  consumer_id: string;
  consumer_name: string;
  total_calls: number;
  total_cost_usd: number;
  personas: {
    persona_id: string;
    persona_name: string;
    capabilities: CapabilityTokenStat[];
  }[];
}

export interface TokenStatGrouped {
  data: PersonaTokenGroup[] | ConsumerTokenGroup[];
  group_by: "persona" | "consumer";
  warning?: string;
  flat_fallback?: TokenStat[];
}

export interface ToolkitDetail extends ToolkitSummary {
  assemblies: AssemblyDetail[];
  agents: Agent[];
  tools: Tool[];
  token_stats: TokenStat[];
}

// ── Consumer / Agent detail ───────────────────────────────────────────────────

export interface CapabilityDetail {
  capability_name: string;
  binding: {
    description: string | null;
    agent_name: string | null;
    agent: {
      model: string | null;
      orchestrator: boolean | null;
      guardrails: boolean | null;
      observability: boolean | null;
    } | null;
  };
}

export interface PersonaDetail extends Persona {
  capabilities: CapabilityDetail[];
}

export interface ConsumerDetail extends Consumer {
  toolkit_name: string;
  personas: PersonaDetail[];
  has_persona_data: boolean;
}

export interface ToolDetail {
  id: string;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
  output_description: string | null;
}

export interface ImpactBinding {
  capability_name: string;
  personas: {
    persona_name: string;
    consumers: string[];
  }[];
}

export interface ImpactEntry {
  assembly_name: string;
  bindings: ImpactBinding[];
}

export interface AgentDetail extends Omit<Agent, "tools_used"> {
  tools_used: ToolDetail[];
  impact_trace: ImpactEntry[];
  has_impact_data: boolean;
}

// ── Access matrix ─────────────────────────────────────────────────────────────

export interface AccessMatrixCapability {
  capability_name: string;
  via_persona: string;
  agent_flags: {
    guardrails: boolean | null;
    observability: boolean | null;
  };
  flags_unknown: boolean;
}

export interface AccessMatrixConsumer {
  id: string;
  name: string;
  capabilities: AccessMatrixCapability[];
}

export interface AccessMatrix {
  consumers: AccessMatrixConsumer[];
  warning?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseTags(tags: string | null): string[] {
  return tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
}

export function parseList(s: string | null): string[] {
  return s ? s.split(",").map((t) => t.trim()).filter(Boolean) : [];
}

export function flagColor(value: boolean | null): string {
  if (value === true)  return "text-emerald-400";
  if (value === false) return "text-red-400";
  return "text-slate-600";
}

export function flagLabel(value: boolean | null): string {
  if (value === true)  return "✓";
  if (value === false) return "✗";
  return "?";
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  stats: () => req<Stats>("/stats"),

  toolkits: (q?: string) =>
    req<ToolkitSummary[]>(`/toolkits${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  toolkit: (id: string) => req<ToolkitDetail>(`/toolkits/${id}`),

  toolkitPushes: (id: string, limit = 50) =>
    req<{ pushes: PushRecord[]; total: number }>(`/toolkits/${id}/pushes?limit=${limit}`),

  spec: (id: string) => fetch(`${base}/toolkits/${id}/spec`),

  tokenStats: (id: string, group_by?: "persona" | "consumer") => {
    const p = group_by ? `?group_by=${group_by}` : "";
    return req<TokenStat[] | TokenStatGrouped>(`/toolkits/${id}/token-stats${p}`);
  },

  accessMatrix: (assembly_id: string) =>
    req<AccessMatrix>(`/assemblies/${assembly_id}/access-matrix`),

  consumers: (q?: string, toolkit_id?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (toolkit_id) p.set("toolkit_id", toolkit_id);
    return req<Consumer[]>(`/consumers${p.size ? `?${p}` : ""}`);
  },

  consumer: (id: string) => req<ConsumerDetail>(`/consumers/${id}`),

  personas: (q?: string, toolkit_id?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (toolkit_id) p.set("toolkit_id", toolkit_id);
    return req<Persona[]>(`/personas${p.size ? `?${p}` : ""}`);
  },

  agents: (opts?: {
    q?: string;
    toolkit_id?: string;
    consumer_id?: string;
    persona_id?: string;
    orchestrator?: boolean;
    guardrails?: boolean;
    observability?: boolean;
  }) => {
    const p = new URLSearchParams();
    if (opts?.q)           p.set("q", opts.q);
    if (opts?.toolkit_id)  p.set("toolkit_id", opts.toolkit_id);
    if (opts?.consumer_id) p.set("consumer_id", opts.consumer_id);
    if (opts?.persona_id)  p.set("persona_id", opts.persona_id);
    if (opts?.orchestrator  !== undefined) p.set("orchestrator",  String(opts.orchestrator));
    if (opts?.guardrails    !== undefined) p.set("guardrails",    String(opts.guardrails));
    if (opts?.observability !== undefined) p.set("observability", String(opts.observability));
    return req<Agent[]>(`/agents${p.size ? `?${p}` : ""}`);
  },

  agent: (id: string) => req<AgentDetail>(`/agents/${id}`),

  tools: (q?: string, toolkit_id?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (toolkit_id) p.set("toolkit_id", toolkit_id);
    return req<Tool[]>(`/tools${p.size ? `?${p}` : ""}`);
  },
};
