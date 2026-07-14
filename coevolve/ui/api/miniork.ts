/**
 * Typed client for `mini-ork serve` (default :7090).
 *
 * Every path here was read off the router decorators in mini_ork/web/routes/*.py —
 * none are guessed. If mini-ork moves a route, this file is the single place that
 * breaks, and `health()` is the probe that tells you so.
 */

export * from './types'
import type {
  ActiveRun,
  AgentPerf,
  ArxivRef,
  BanditArm,
  CircuitBreaker,
  ConductorDecision,
  CostByDay,
  Failure,
  FleetSummary,
  GroundedRejection,
  LearningSummary,
  Pattern,
  Promotion,
  PromptWinRate,
  Review,
  ReviewIssue,
  SelfImproveRun,
  TaskRun,
  TopologyWinRate
} from './types'

export const MINIORK_BASE = 'http://127.0.0.1:7090'

// ── shapes (from the SELECT lists in the route handlers) ─────────────────────

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
