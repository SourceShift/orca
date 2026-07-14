/**
 * Typed client for `mini-ork serve` (default :7090).
 *
 * Every path here was read off the router decorators in mini_ork/web/routes/*.py —
 * none are guessed. If mini-ork moves a route, this file is the single place that
 * breaks, and `health()` is the probe that tells you so.
 */

export const MINIORK_BASE = 'http://127.0.0.1:7090'

// ── shapes (from the SELECT lists in the route handlers) ─────────────────────

export type ActiveRun = {
  id: string
  epic_id: string | null
  run_dir: string | null
  branch: string | null
  agent: string | null
  started_at: string | null
  /** 'runs' | 'task_runs' — which table this row came from */
  source: string
  task_run_id: string | null
  status: string | null
}

export type TaskRun = {
  id: string
  parent_epic_id: string | null
  task_class: string | null
  recipe: string | null
  status: string | null
  verdict: string | null
}

export type FleetSummary = {
  by_recipe: { recipe: string; count: number; cost: number | null }[]
  by_status: { status: string; count: number }[]
  total_cost_usd: number
}

export type SelfImproveRun = {
  run_id: string
  iter: number
  outcome: string | null
  started_at: string | null
  finished_at: string | null
  parent_run_id: string | null
  branch_name: string | null
  notes: string | null
}

export type CostByDay = {
  day: string
  cost_usd: number
}

// ── transport ────────────────────────────────────────────────────────────────

export class MiniOrkOffline extends Error {
  constructor(cause?: unknown) {
    super('mini-ork serve is not reachable on :7090')
    this.name = 'MiniOrkOffline'
    this.cause = cause
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${MINIORK_BASE}${path}`, { signal })
  } catch (e) {
    // A dead daemon must surface as "offline", never as empty data. Rendering an
    // empty panel for an unreachable backend is a vacuous pass at the UI layer.
    throw new MiniOrkOffline(e)
  }
  if (!res.ok) {
    throw new Error(`mini-ork ${path} → HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${MINIORK_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch (e) {
    throw new MiniOrkOffline(e)
  }
  if (!res.ok) {
    throw new Error(`mini-ork ${path} → HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

// ── read ─────────────────────────────────────────────────────────────────────

export const health = (signal?: AbortSignal) => get<{ status?: string }>('/api/v1/health', signal)

export const activeRuns = (signal?: AbortSignal) => get<ActiveRun[]>('/api/v1/runs/active', signal)

export const taskRuns = (signal?: AbortSignal) => get<TaskRun[]>('/api/v1/task-runs', signal)

export const fleetSummary = (signal?: AbortSignal) =>
  get<FleetSummary>('/api/v1/task-runs/summary', signal)

/** The compounding curve: one row per self-improvement iteration. */
export const selfImprove = (signal?: AbortSignal) =>
  get<SelfImproveRun[]>('/api/v1/trajectory/self-improve', signal)

/** The cost axis of the deck — spend per day, straight from state.db. */
export const costByDay = (signal?: AbortSignal) =>
  get<CostByDay[]>('/api/v1/trajectory/cost-by-day', signal)

/** GEPA prompt gradients — what the loop learned and applied. */
export const gradients = (signal?: AbortSignal) =>
  get<unknown[]>('/api/v1/trajectory/gradients', signal)

export const runDag = (taskRunId: string, signal?: AbortSignal) =>
  get<unknown>(`/api/v1/task-runs/${taskRunId}/dag`, signal)

/** Why the router picked the lane it picked — the learning loop, per run. */
export const runLearning = (taskRunId: string, signal?: AbortSignal) =>
  get<unknown>(`/api/v1/task-runs/${taskRunId}/learning`, signal)

export const runWhy = (taskRunId: string, signal?: AbortSignal) =>
  get<unknown>(`/api/v1/task-runs/${taskRunId}/why`, signal)

// ── control (this is what makes Orca a control plane, not a dashboard) ───────

export const steer = (taskRunId: string, message: string) =>
  post<unknown>(`/api/v1/task-runs/${taskRunId}/steer`, { message })

export const stop = (taskRunId: string) => post<unknown>(`/api/v1/task-runs/${taskRunId}/stop`, {})

export const kill = (taskRunId: string) => post<unknown>(`/api/v1/task-runs/${taskRunId}/kill`, {})

export const answer = (taskRunId: string, answers: Record<string, string>) =>
  post<unknown>(`/api/v1/task-runs/${taskRunId}/answers`, answers)

// ── the brain: /api/v1/learning/* ────────────────────────────────────────────
// An audit found 28 of 37 populated state.db tables were served by NO endpoint —
// including the bandit policy and GEPA's outcomes. These routes were added to
// mini-ork (mini_ork/web/routes/learning.py) so the loop could actually be seen.

export type LearningSummary = {
  bandit_arms: number
  gradients: number
  promotions: number
  /** promotions whose decision actually ACCEPTED the candidate */
  promoted: number
  prompt_versions_scored: number
  failures: number
  patterns: number
  topologies: number
  open_circuit_breakers: number
  traces: number
  llm_calls: number
}

/** One arm of the contextual bandit — a lane's learned advantage in a context. */
export type BanditArm = {
  agent_version_id: string
  task_class: string | null
  node_type: string | null
  objective_domain: string | null
  /** present only on region rows (the finer partition) */
  code_region?: string | null
  relative_advantage: number
  runs_count: number
  success_count: number
  last_updated: string | null
}

export type PromptWinRate = {
  prompt_version_hash: string
  task_class: string | null
  node_type: string | null
  agent_role: string | null
  wins: number
  losses: number
  ties: number
  win_rate: number
  sample_size: number
}

export type Promotion = {
  promotion_id: string
  candidate_id: string | null
  from_version_id: string | null
  to_version_id: string | null
  utility_before: number | null
  utility_after: number | null
  rationale: string | null
  decision: string | null
  decided_at: string | null
  decided_by: string | null
}

export type Failure = {
  failure_id: string
  run_id: string | number | null
  workflow_stage: string | null
  failure_category: string | null
  error_message: string | null
  occurred_at: string | null
}

export type Pattern = {
  pattern_id: string
  cluster_label: string | null
  strength_score: number | null
  suggested_meta_adr: string | null
  status: string | null
  detected_at: string | null
}

export type TopologyWinRate = {
  topology_id: string
  workflow_name: string | null
  task_class: string | null
  wins: number
  losses: number
  ties: number
  win_rate: number
  sample_size: number
  avg_cost_usd: number | null
  avg_duration_ms: number | null
}

export type CircuitBreaker = {
  scope_key: string
  state: string
  opened_at: string | null
  last_reason: string | null
  trip_count: number
  updated_at: string | null
}

export const learningSummary = (signal?: AbortSignal) =>
  get<LearningSummary>('/api/v1/learning/summary', signal)

/** The router's learned policy — which lane is trusted with which kind of work. */
export const bandit = (signal?: AbortSignal) =>
  get<{ domain: BanditArm[]; region: BanditArm[] }>('/api/v1/learning/bandit', signal)

/** GEPA: proposals (gradients), what won (win_rates), what shipped (promotions). */
export const gepa = (signal?: AbortSignal) =>
  get<{ gradient_count: number; win_rates: PromptWinRate[]; promotions: Promotion[] }>(
    '/api/v1/learning/gepa',
    signal
  )

export const failures = (signal?: AbortSignal) =>
  get<{
    recent: Failure[]
    by_category: { failure_category: string; workflow_stage: string; count: number }[]
  }>('/api/v1/learning/failures', signal)

export const patterns = (signal?: AbortSignal) =>
  get<Pattern[]>('/api/v1/learning/patterns', signal)

export const topology = (signal?: AbortSignal) =>
  get<{ win_rates: TopologyWinRate[]; role_evolution: unknown[] }>(
    '/api/v1/learning/topology',
    signal
  )

export const circuitBreakers = (signal?: AbortSignal) =>
  get<CircuitBreaker[]>('/api/v1/learning/circuit-breakers', signal)

export type AgentPerf = {
  agent_version_id: string
  role: string | null
  model: string | null
  task_class: string | null
  runs_count: number
  success_count: number
  avg_cost_usd: number | null
  avg_duration_ms: number | null
  top_failure_modes: string | null
  relative_advantage: number | null
}

export type GroundedRejection = {
  id: number
  run_id: string | number | null
  gate_name: string | null
  verdict: string | null
  concern: string | null
  evidence_summary: string | null
  suggestion: string | null
  ts: string | number | null
}

export type Review = {
  id: number
  reviewed_at: string | number | null
  source_sha: string | null
  target_branch: string | null
  verdict: string | null
  files_changed: number | null
  issues_open: number | null
  issues_critical: number | null
  cost_usd: number | null
  rationale: string | null
}

export type ReviewIssue = {
  id: number
  review_id: number
  lens: string | null
  severity: string | null
  file_path: string | null
  line_no: number | null
  title: string | null
  status: string | null
}

export type ConductorDecision = {
  id: number
  decided_at: string | number | null
  epic_id: string | null
  task_class: string | null
  chosen_topology: string | null
  chosen_recipe: string | null
  chosen_lane_hints: string | null
  predicted_score: number | null
  realized_score: number | null
  budget_pct_used: number | null
  rationale: string | null
  outcome: string | null
}

export type ArxivRef = {
  id: number
  run_id: string | null
  arxiv_id: string
  title: string | null
  technique: string | null
  mapped_file: string | null
  confidence: number | null
  /** the honest column: reading a paper is not learning from it */
  used_in_patch: number | null
  created_at: string | null
}

/** task_memory (per-run outcome/cost) + agent_performance_memory (per-lane record). */
export const memory = (signal?: AbortSignal) =>
  get<{ tasks: unknown[]; agents: AgentPerf[] }>('/api/v1/learning/memory', signal)

/** Registered gates + the rejections they GROUNDED in evidence (anti-Goodhart trail). */
export const gates = (signal?: AbortSignal) =>
  get<{ registry: unknown[]; rejections: GroundedRejection[] }>('/api/v1/learning/gates', signal)

export const reviews = (signal?: AbortSignal) =>
  get<{ reviews: Review[]; issues: ReviewIssue[]; bug_reports: unknown[] }>(
    '/api/v1/learning/reviews',
    signal
  )

/** The conductor's PREDICTED vs REALIZED score — its calibration. */
export const conductor = (signal?: AbortSignal) =>
  get<{ decisions: ConductorDecision[]; spawns: unknown[] }>('/api/v1/learning/conductor', signal)

export const workflows = (signal?: AbortSignal) =>
  get<{ candidates: unknown[]; versions: unknown[] }>('/api/v1/learning/workflows', signal)

export const benchmarks = (signal?: AbortSignal) =>
  get<{ tasks: unknown[]; results: unknown[] }>('/api/v1/learning/benchmarks', signal)

/** The arXiv-driven R&D loop: papers read → technique → did it reach a patch? */
export const research = (signal?: AbortSignal) =>
  get<ArxivRef[]>('/api/v1/learning/research', signal)

export const epicDependencies = (signal?: AbortSignal) =>
  get<unknown[]>('/api/v1/learning/epic-dependencies', signal)

// ── traces ───────────────────────────────────────────────────────────────────

export const runEvents = (taskRunId: string, signal?: AbortSignal) =>
  get<unknown[]>(`/api/v1/task-runs/${taskRunId}/events`, signal)

export const runLlmCalls = (taskRunId: string, signal?: AbortSignal) =>
  get<unknown[]>(`/api/v1/task-runs/${taskRunId}/llm-calls`, signal)

export const runEvidence = (taskRunId: string, signal?: AbortSignal) =>
  get<unknown>(`/api/v1/task-runs/${taskRunId}/evidence`, signal)

export const runAgents = (taskRunId: string, signal?: AbortSignal) =>
  get<unknown[]>(`/api/v1/task-runs/${taskRunId}/agents`, signal)

// ── live ─────────────────────────────────────────────────────────────────────

/** SSE stream of run events. Returns an unsubscribe fn. */
export function subscribe(onEvent: (e: MessageEvent) => void, onError?: () => void): () => void {
  const es = new EventSource(`${MINIORK_BASE}/api/v1/stream`)
  es.onmessage = onEvent
  es.onerror = () => onError?.()
  return () => es.close()
}
