/**
 * The brain — the learning loop's internals, rendered.
 *
 * Every view here reads an endpoint that did not exist a day ago: an audit found
 * 28 of 37 populated state.db tables were served by nothing. The bandit's learned
 * policy and GEPA's outcomes were among them — so the loop could be watched running
 * but never watched LEARNING. That distinction is the entire product.
 */
import { useCallback } from 'react'
import * as mo from '../api/miniork'
import { useMiniOrk, type Load } from '../useMiniOrk'

// ── shared chrome ────────────────────────────────────────────────────────────

export function Offline(): React.JSX.Element {
  return (
    <div className="rounded-md border border-amber-600/40 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
      <div className="font-medium">mini-ork is not running.</div>
      <div className="mt-1 opacity-80">
        <code className="rounded bg-black/40 px-1">mini-ork serve --port 7090</code>
      </div>
      <div className="mt-1.5 opacity-60">
        Showing nothing rather than an empty panel — an empty panel for a dead backend is a lie.
      </div>
    </div>
  )
}

function Rows<T>({
  load,
  empty,
  children
}: {
  load: Load<T[]>
  empty: string
  children: (rows: T[]) => React.JSX.Element
}): React.JSX.Element {
  if (load.state === 'loading') {
    return <div className="text-[11px] opacity-40">…</div>
  }
  if (load.state === 'offline') {
    return <Offline />
  }
  if (load.data.length === 0) {
    return <div className="text-[11px] opacity-40">{empty}</div>
  }
  return children(load.data)
}

/** A signed advantage/utility delta, coloured by direction. */
function Delta({ v, digits = 3 }: { v: number | null; digits?: number }): React.JSX.Element {
  if (v == null) {
    return <span className="opacity-40">—</span>
  }
  const tone = v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'opacity-50'
  return (
    <span className={`font-mono tabular-nums ${tone}`}>
      {v > 0 ? '+' : ''}
      {v.toFixed(digits)}
    </span>
  )
}

function Bar({
  pct,
  tone = 'bg-emerald-600/70'
}: {
  pct: number
  tone?: string
}): React.JSX.Element {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-800">
      <div className={`h-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

// ── BANDIT — the router's learned policy ─────────────────────────────────────

export function BanditView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.bandit(s), [])
  const load = useMiniOrk(fetch, 10_000)

  if (load.state === 'loading') {
    return <div className="text-[11px] opacity-40">…</div>
  }
  if (load.state === 'offline') {
    return <Offline />
  }

  // Region rows are the finer partition (they carry code_region); domain rows are
  // the coarse fallback the router uses when a region has too few samples.
  const arms = [...load.data.region, ...load.data.domain]
  if (arms.length === 0) {
    return (
      <div className="text-[11px] opacity-40">No arms learned yet — the router is still cold.</div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] opacity-50">
        Which lane is trusted with which work. Advantage is group-relative; the router reads this at
        dispatch.
      </div>
      {arms.slice(0, 24).map((a, i) => {
        const winRate = a.runs_count > 0 ? (a.success_count / a.runs_count) * 100 : 0
        return (
          <div
            key={`${a.agent_version_id}-${a.task_class}-${a.code_region ?? 'domain'}-${i}`}
            className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-[11px]">{a.agent_version_id}</span>
              <Delta v={a.relative_advantage} />
            </div>
            <div className="mt-0.5 truncate text-[10px] opacity-50">
              {a.task_class ?? '—'} · {a.node_type ?? '—'}
              {a.code_region ? ` · ${a.code_region}` : ''}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <Bar pct={winRate} />
              <span className="shrink-0 font-mono text-[9px] tabular-nums opacity-50">
                {a.success_count}/{a.runs_count}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── GEPA — proposals, what won, what actually shipped ────────────────────────

export function GepaView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.gepa(s), [])
  const load = useMiniOrk(fetch, 15_000)

  if (load.state === 'loading') {
    return <div className="text-[11px] opacity-40">…</div>
  }
  if (load.state === 'offline') {
    return <Offline />
  }

  const { gradient_count, win_rates, promotions } = load.data
  const accepted = promotions.filter((p) =>
    ['promote', 'promoted', 'accept', 'accepted'].includes((p.decision ?? '').toLowerCase())
  ).length

  return (
    <div className="flex flex-col gap-2">
      {/* The funnel is the point: proposing is cheap, promoting is the learning. */}
      <div className="grid grid-cols-3 gap-1 text-center">
        {[
          ['proposed', gradient_count],
          ['scored', win_rates.length],
          ['promoted', accepted]
        ].map(([label, n]) => (
          <div
            key={label as string}
            className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5"
          >
            <div className="font-mono text-sm tabular-nums">{n as number}</div>
            <div className="text-[9px] uppercase tracking-wide opacity-50">{label as string}</div>
          </div>
        ))}
      </div>

      {promotions.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide opacity-50">Promotions</div>
          <div className="flex flex-col gap-1">
            {promotions.slice(0, 6).map((p) => {
              const gain =
                p.utility_after != null && p.utility_before != null
                  ? p.utility_after - p.utility_before
                  : null
              return (
                <div
                  key={p.promotion_id}
                  className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[11px]">{p.decision ?? 'pending'}</span>
                    <Delta v={gain} />
                  </div>
                  {p.rationale ? (
                    <div className="mt-0.5 line-clamp-2 text-[10px] opacity-50">{p.rationale}</div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {win_rates.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide opacity-50">
            Prompt win rates
          </div>
          <div className="flex flex-col gap-1">
            {win_rates.slice(0, 8).map((w) => (
              <div
                key={w.prompt_version_hash}
                className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-mono text-[10px] opacity-70">
                    {w.prompt_version_hash.slice(0, 10)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {(w.win_rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] opacity-50">
                  {w.agent_role ?? w.node_type ?? '—'} · n={w.sample_size}
                </div>
                <div className="mt-1">
                  <Bar
                    pct={w.win_rate * 100}
                    tone={w.win_rate >= 0.5 ? 'bg-emerald-600/70' : 'bg-red-700/60'}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── FAILURES — the largest dark dataset in the db ────────────────────────────

export function FailuresView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.failures(s), [])
  const load = useMiniOrk(fetch, 15_000)

  if (load.state === 'loading') {
    return <div className="text-[11px] opacity-40">…</div>
  }
  if (load.state === 'offline') {
    return <Offline />
  }

  const { recent, by_category } = load.data
  const max = Math.max(1, ...by_category.map((c) => c.count))

  return (
    <div className="flex flex-col gap-2">
      {by_category.slice(0, 8).map((c) => (
        <div key={`${c.failure_category}-${c.workflow_stage}`}>
          <div className="flex items-baseline justify-between gap-2 text-[10px]">
            <span className="truncate">
              {c.failure_category ?? 'uncategorised'}
              <span className="opacity-40"> · {c.workflow_stage ?? '—'}</span>
            </span>
            <span className="font-mono tabular-nums opacity-60">{c.count}</span>
          </div>
          <div className="mt-0.5">
            <Bar pct={(c.count / max) * 100} tone="bg-red-700/60" />
          </div>
        </div>
      ))}

      {recent.length > 0 && (
        <div className="mt-1">
          <div className="mb-1 text-[10px] uppercase tracking-wide opacity-50">Most recent</div>
          {recent.slice(0, 5).map((f) => (
            <div
              key={f.failure_id}
              className="mb-1 rounded border border-neutral-800 bg-neutral-900/40 p-1.5"
            >
              <div className="truncate text-[10px]">
                <span className="text-red-400">{f.failure_category ?? 'error'}</span>
                <span className="opacity-40"> · {f.workflow_stage ?? '—'}</span>
              </div>
              {f.error_message ? (
                <div className="mt-0.5 line-clamp-2 font-mono text-[10px] opacity-50">
                  {f.error_message}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── PATTERNS — what the system noticed about itself ──────────────────────────

export function PatternsView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.patterns(s), [])
  const load = useMiniOrk(fetch, 30_000)

  return (
    <Rows load={load} empty="No emergent patterns detected yet.">
      {(rows) => (
        <div className="flex flex-col gap-1">
          {rows.slice(0, 12).map((p) => (
            <div
              key={p.pattern_id}
              className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px]">{p.cluster_label ?? p.pattern_id}</span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums opacity-60">
                  {p.strength_score != null ? p.strength_score.toFixed(2) : '—'}
                </span>
              </div>
              {p.suggested_meta_adr ? (
                <div className="mt-0.5 line-clamp-2 text-[10px] opacity-50">
                  → {p.suggested_meta_adr}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Rows>
  )
}

// ── TOPOLOGY — the panel shape is learned too ────────────────────────────────

export function TopologyView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.topology(s), [])
  const load = useMiniOrk(fetch, 30_000)

  if (load.state === 'loading') {
    return <div className="text-[11px] opacity-40">…</div>
  }
  if (load.state === 'offline') {
    return <Offline />
  }
  if (load.data.win_rates.length === 0) {
    return <div className="text-[11px] opacity-40">No topologies scored yet.</div>
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] opacity-50">Which panel shapes win — and what they cost.</div>
      {load.data.win_rates.slice(0, 12).map((t) => (
        <div
          key={t.topology_id}
          className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-[11px]">{t.topology_id}</span>
            <span className="font-mono text-[11px] tabular-nums">
              {(t.win_rate * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-0.5 truncate text-[10px] opacity-50">
            {t.task_class ?? '—'} · n={t.sample_size}
            {t.avg_cost_usd != null ? ` · $${t.avg_cost_usd.toFixed(3)}/run` : ''}
          </div>
          <div className="mt-1">
            <Bar pct={t.win_rate * 100} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── GOVERNANCE — an open breaker is why nothing is happening ─────────────────

export function BreakersView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.circuitBreakers(s), [])
  const load = useMiniOrk(fetch, 10_000)

  return (
    <Rows load={load} empty="No circuit breakers registered.">
      {(rows) => (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] opacity-50">
            An OPEN breaker is why a run silently is not happening.
          </div>
          {rows.map((b) => {
            const open = b.state.toLowerCase() === 'open'
            return (
              <div
                key={b.scope_key}
                className={`rounded border p-1.5 ${
                  open ? 'border-red-700/50 bg-red-950/30' : 'border-neutral-800 bg-neutral-900/40'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-mono text-[10px]">{b.scope_key}</span>
                  <span
                    className={`shrink-0 text-[9px] uppercase tracking-wide ${
                      open ? 'text-red-300' : 'opacity-50'
                    }`}
                  >
                    {b.state}
                  </span>
                </div>
                {open && b.last_reason ? (
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-red-300/80">
                    {b.last_reason}
                  </div>
                ) : null}
                {b.trip_count > 0 ? (
                  <div className="mt-0.5 text-[10px] opacity-40">tripped {b.trip_count}×</div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </Rows>
  )
}
