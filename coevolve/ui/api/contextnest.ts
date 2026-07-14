/**
 * Typed client for ContextNest — the memory substrate (Rust, WAL-backed).
 *
 * Port is 28080, NOT 7048. The inherited INTEGRATION.md claimed 7048; that is the
 * z-dashboard daemon's port and nothing listens there. Every path below was read off
 * the `.route("...")` calls in ContextNest's own src/ — none guessed.
 *
 * This is the lane that CLOSES the loop. mini-ork shows run → verdict → learning;
 * ContextNest shows where that learning went and what it is being asked to do next.
 */

export const CN_BASE = 'http://127.0.0.1:28080'

export type CnStats = {
  total_fragments: number
  total_sessions: number
  by_kind: Record<string, number>
}

/** An item in the attention queue — the substrate saying "a human is needed here". */
export type InboxItem = {
  id: string
  session_id: string | null
  content: string
  kind?: string | null
  status?: string | null
  urgency?: string | null
  ts?: string | null
}

/** A named deliverable a session claimed to ship, with a replayable test recipe. */
export type CnFeature = {
  session_id: string
  feature: string
  layer?: string | null
  files?: string[] | null
  refs?: string[] | null
  how_to_test?: string | null
}

/** A semantic hit from the memory substrate. */
export type Fragment = {
  id: string
  content: string
  importance: number
  similarity: number
  metadata?: Record<string, unknown>
}

export class CnOffline extends Error {
  constructor(cause?: unknown) {
    super('ContextNest is not reachable on :28080')
    this.name = 'CnOffline'
    this.cause = cause
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${CN_BASE}${path}`, { signal })
  } catch (e) {
    // Offline must never render as empty. A dead memory substrate showing "0 lessons"
    // is a lie — the same vacuous pass mini_ork_verify.py:173 refuses.
    throw new CnOffline(e)
  }
  if (!res.ok) {
    throw new Error(`contextnest ${path} → HTTP ${res.status}`)
  }
  return (await res.json()) as T
}

export const health = (signal?: AbortSignal): Promise<{ status: string; healthy: boolean }> =>
  get('/api/health', signal)

/** How much the system remembers, broken down by kind. */
export const stats = (signal?: AbortSignal): Promise<CnStats> => get('/api/v1/stats', signal)

/** The attention queue: what the substrate thinks needs a human. */
export const inbox = (signal?: AbortSignal): Promise<{ items: InboxItem[] }> =>
  get('/api/v1/inbox', signal)

/** Named deliverables shipped in a window, with how_to_test recipes. */
export const features = (
  since = '24h',
  signal?: AbortSignal
): Promise<{ since: string; count: number; features: CnFeature[] }> =>
  get(`/api/v1/features?since=${encodeURIComponent(since)}`, signal)

/** Semantic retrieval over the substrate — what does it already know about X? */
export async function retrieve(query: string, k = 5): Promise<Fragment[]> {
  let res: Response
  try {
    res = await fetch(`${CN_BASE}/api/v1/tools/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, k })
    })
  } catch (e) {
    throw new CnOffline(e)
  }
  if (!res.ok) {
    throw new Error(`contextnest retrieve → HTTP ${res.status}`)
  }
  const body = (await res.json()) as { hits?: Fragment[] }
  return body.hits ?? []
}
