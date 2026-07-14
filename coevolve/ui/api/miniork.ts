/**
 * Typed client for `mini-ork serve` (default :7090).
 *
 * Every path here was read off the router decorators in mini_ork/web/routes/*.py —
 * none are guessed. If mini-ork moves a route, this file is the single place that
 * breaks, and `health()` is the probe that tells you so.
 */

export const MINIORK_BASE = 'http://127.0.0.1:7090'

// ── shapes (from the SELECT lists in the route handlers) ─────────────────────

export interface ActiveRun {
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

export interface TaskRun {
  id: string
  parent_epic_id: string | null
  task_class: string | null
  recipe: string | null
  status: string | null
  verdict: string | null
}

export interface FleetSummary {
  by_recipe: Array<{ recipe: string; count: number; cost: number | null }>
  by_status: Array<{ status: string; count: number }>
  total_cost_usd: number
}

export interface SelfImproveRun {
  run_id: string
  iter: number
  outcome: string | null
  started_at: string | null
  finished_at: string | null
  parent_run_id: string | null
  branch_name: string | null
  notes: string | null
}

export interface CostByDay {
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
  if (!res.ok) throw new Error(`mini-ork ${path} → HTTP ${res.status}`)
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
  if (!res.ok) throw new Error(`mini-ork ${path} → HTTP ${res.status}`)
  return (await res.json()) as T
}

// ── read ─────────────────────────────────────────────────────────────────────

export const health = (signal?: AbortSignal) => get<{ status?: string }>('/api/v1/health', signal)

export const activeRuns = (signal?: AbortSignal) =>
  get<ActiveRun[]>('/api/v1/runs/active', signal)

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

// ── live ─────────────────────────────────────────────────────────────────────

/** SSE stream of run events. Returns an unsubscribe fn. */
export function subscribe(onEvent: (e: MessageEvent) => void, onError?: () => void): () => void {
  const es = new EventSource(`${MINIORK_BASE}/api/v1/stream`)
  es.onmessage = onEvent
  es.onerror = () => onError?.()
  return () => es.close()
}
