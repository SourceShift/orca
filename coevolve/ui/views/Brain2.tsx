/**
 * The rest of the brain: review, memory, conductor calibration, and the arXiv loop.
 * Split from Brain.tsx purely to keep files readable.
 */
import { useCallback } from 'react'
import * as mo from '../api/miniork'
import { useMiniOrk } from '../useMiniOrk'
import { Offline } from './Brain'

function Delta({ v, digits = 2 }: { v: number | null; digits?: number }): React.JSX.Element {
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

// ── REVIEW — the pre-push panel's findings ───────────────────────────────────

export function ReviewView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.reviews(s), [])
  const load = useMiniOrk(fetch, 20_000)

  if (load.state === 'loading') {
    return <div className="text-[11px] opacity-40">…</div>
  }
  if (load.state === 'offline') {
    return <Offline />
  }

  const { reviews, issues } = load.data
  if (reviews.length === 0) {
    return <div className="text-[11px] opacity-40">No pre-push reviews yet.</div>
  }

  const critical = issues.filter((i) => (i.severity ?? '').toLowerCase() === 'critical')

  return (
    <div className="flex flex-col gap-2">
      {critical.length > 0 && (
        <div className="rounded border border-red-700/50 bg-red-950/30 p-1.5 text-[10px] text-red-300">
          {critical.length} critical issue{critical.length === 1 ? '' : 's'} open
        </div>
      )}

      {reviews.slice(0, 8).map((r) => {
        const v = (r.verdict ?? '').toLowerCase()
        const tone =
          v === 'pass'
            ? 'text-emerald-400'
            : v.includes('fail') || v.includes('block')
              ? 'text-red-400'
              : 'opacity-60'
        return (
          <div key={r.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-[10px] opacity-70">
                {(r.source_sha ?? '').slice(0, 10)}
              </span>
              <span className={`shrink-0 text-[10px] uppercase ${tone}`}>{r.verdict ?? '—'}</span>
            </div>
            <div className="mt-0.5 truncate text-[10px] opacity-50">
              {r.files_changed ?? 0} files · {r.issues_open ?? 0} open
              {r.issues_critical ? ` · ${r.issues_critical} critical` : ''}
              {r.cost_usd != null ? ` · $${r.cost_usd.toFixed(2)}` : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── MEMORY — per-lane performance record ────────────────────────────────────

export function MemoryView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.memory(s), [])
  const load = useMiniOrk(fetch, 20_000)

  if (load.state === 'loading') {
    return <div className="text-[11px] opacity-40">…</div>
  }
  if (load.state === 'offline') {
    return <Offline />
  }
  if (load.data.agents.length === 0) {
    return <div className="text-[11px] opacity-40">No agent performance memory yet.</div>
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] opacity-50">
        What each lane actually costs, and how often it works.
      </div>
      {load.data.agents.slice(0, 16).map((a) => (
        <div
          key={`${a.agent_version_id}-${a.task_class}`}
          className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-[11px]">{a.agent_version_id}</span>
            <Delta v={a.relative_advantage} digits={3} />
          </div>
          <div className="mt-0.5 truncate text-[10px] opacity-50">
            {a.model ?? a.role ?? '—'} · {a.task_class ?? '—'}
          </div>
          <div className="mt-0.5 flex gap-2 font-mono text-[10px] tabular-nums opacity-60">
            <span>
              {a.success_count}/{a.runs_count}
            </span>
            {a.avg_cost_usd != null ? <span>${a.avg_cost_usd.toFixed(3)}/run</span> : null}
          </div>
          {a.top_failure_modes ? (
            <div className="mt-0.5 line-clamp-1 text-[10px] text-red-400/70">
              {a.top_failure_modes}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ── CONDUCTOR — predicted vs realized: is the meta-policy calibrated? ────────

export function ConductorView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.conductor(s), [])
  const load = useMiniOrk(fetch, 20_000)

  if (load.state === 'loading') {
    return <div className="text-[11px] opacity-40">…</div>
  }
  if (load.state === 'offline') {
    return <Offline />
  }
  if (load.data.decisions.length === 0) {
    return <div className="text-[11px] opacity-40">No conductor decisions yet.</div>
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] opacity-50">
        Predicted vs realized. A conductor that predicts badly cannot be trusted with budget.
      </div>
      {load.data.decisions.slice(0, 10).map((d) => {
        const err =
          d.predicted_score != null && d.realized_score != null
            ? d.realized_score - d.predicted_score
            : null
        return (
          <div key={d.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-mono text-[10px]">
                {d.chosen_recipe ?? d.task_class ?? '—'}
              </span>
              <Delta v={err} />
            </div>
            <div className="mt-0.5 truncate text-[10px] opacity-50">
              {d.chosen_topology ?? '—'}
              {d.predicted_score != null ? ` · pred ${d.predicted_score.toFixed(2)}` : ''}
              {d.realized_score != null ? ` · got ${d.realized_score.toFixed(2)}` : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── R&D — the arXiv loop, with the honest column ────────────────────────────

export function ResearchView(): React.JSX.Element {
  const fetch = useCallback((s?: AbortSignal) => mo.research(s), [])
  const load = useMiniOrk(fetch, 60_000)

  if (load.state === 'loading') {
    return <div className="text-[11px] opacity-40">…</div>
  }
  if (load.state === 'offline') {
    return <Offline />
  }
  if (load.data.length === 0) {
    return (
      <div className="text-[11px] opacity-40">No papers read by the self-improve loop yet.</div>
    )
  }

  const applied = load.data.filter((r) => r.used_in_patch).length

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] opacity-50">
        Papers read → technique → did it reach a patch?{' '}
        <span className="font-mono">
          {applied}/{load.data.length} applied
        </span>
        . Reading a paper is not learning from it.
      </div>
      {load.data.slice(0, 12).map((r) => (
        <div key={r.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-mono text-[10px] opacity-70">{r.arxiv_id}</span>
            {r.used_in_patch ? (
              <span className="shrink-0 rounded border border-emerald-700/40 bg-emerald-950/40 px-1 text-[9px] uppercase text-emerald-300">
                applied
              </span>
            ) : (
              <span className="shrink-0 text-[9px] uppercase opacity-40">read</span>
            )}
          </div>
          {r.title ? <div className="mt-0.5 line-clamp-2 text-[10px]">{r.title}</div> : null}
          {r.technique ? (
            <div className="mt-0.5 line-clamp-1 text-[10px] opacity-50">→ {r.technique}</div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
