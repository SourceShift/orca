/**
 * The Co-Evolve panel — the whole learning loop in one view, mounted natively
 * inside Orca's renderer (not an iframe).
 *
 * Renders: run → verdict → cost → what the loop learned. Plus live steering,
 * which is what makes Orca a control plane rather than a dashboard.
 */
import { useCallback, useEffect, useState } from 'react'
import * as mo from './api/miniork'

type Load<T> = { state: 'loading' } | { state: 'offline' } | { state: 'ok'; data: T }

function useMiniOrk<T>(fetcher: (s?: AbortSignal) => Promise<T>, pollMs = 4000): Load<T> {
  const [v, setV] = useState<Load<T>>({ state: 'loading' })

  useEffect(() => {
    let alive = true
    const ac = new AbortController()

    const tick = async () => {
      try {
        const data = await fetcher(ac.signal)
        if (alive) setV({ state: 'ok', data })
      } catch (e) {
        if (!alive || ac.signal.aborted) return
        // Offline is a DISTINCT state from empty. An unreachable daemon must never
        // render as "0 runs, all good" — that is a vacuous pass at the UI layer.
        setV(e instanceof mo.MiniOrkOffline ? { state: 'offline' } : { state: 'offline' })
      }
    }

    void tick()
    const id = setInterval(tick, pollMs)
    return () => {
      alive = false
      ac.abort()
      clearInterval(id)
    }
  }, [fetcher, pollMs])

  return v
}

function Offline(): React.JSX.Element {
  return (
    <div className="rounded-md border border-amber-600/40 bg-amber-950/30 p-3 text-xs text-amber-200">
      <div className="font-medium">mini-ork is not running.</div>
      <div className="mt-1 opacity-80">
        Start it with{' '}
        <code className="rounded bg-black/40 px-1 py-0.5">mini-ork serve --port 7090</code>
      </div>
      <div className="mt-2 opacity-60">
        Showing nothing rather than an empty panel — an empty panel for a dead backend is a lie.
      </div>
    </div>
  )
}

function Verdict({ verdict }: { verdict: string | null }): React.JSX.Element {
  const v = (verdict ?? '').toLowerCase()
  const tone =
    v === 'pass'
      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/40'
      : v === 'fail' || v === 'needs_revision'
        ? 'bg-red-950/40 text-red-300 border-red-700/40'
        : 'bg-neutral-800/60 text-neutral-400 border-neutral-700/50'
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}>
      {verdict ?? 'unverified'}
    </span>
  )
}

function ActiveRuns(): React.JSX.Element {
  const runs = useMiniOrk(mo.activeRuns)
  const [steering, setSteering] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const send = useCallback(
    async (id: string) => {
      if (!msg.trim()) return
      await mo.steer(id, msg.trim())
      setMsg('')
      setSteering(null)
    },
    [msg]
  )

  if (runs.state === 'loading') return <div className="text-xs opacity-50">…</div>
  if (runs.state === 'offline') return <Offline />
  if (runs.data.length === 0)
    return <div className="text-xs opacity-50">No active runs. mini-ork is idle.</div>

  return (
    <div className="flex flex-col gap-1.5">
      {runs.data.map((r) => {
        const id = r.task_run_id ?? r.id
        return (
          <div key={id} className="rounded-md border border-neutral-700/50 bg-neutral-900/40 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[11px]">{r.branch ?? id.slice(0, 12)}</span>
              <Verdict verdict={r.status} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] opacity-60">
              <span>{r.agent ?? 'agent'}</span>
              {r.started_at ? <span>· {r.started_at}</span> : null}
            </div>

            {r.task_run_id ? (
              steering === id ? (
                <div className="mt-2 flex gap-1">
                  <input
                    autoFocus
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void send(id)
                      if (e.key === 'Escape') setSteering(null)
                    }}
                    placeholder="Steer this run…"
                    className="flex-1 rounded border border-neutral-700 bg-black/40 px-1.5 py-1 text-[11px] outline-none focus:border-neutral-500"
                  />
                  <button
                    onClick={() => void send(id)}
                    className="rounded bg-neutral-700 px-2 text-[11px] hover:bg-neutral-600"
                  >
                    Send
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => setSteering(id)}
                    className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] hover:bg-neutral-800"
                  >
                    Steer
                  </button>
                  <button
                    onClick={() => void mo.stop(id)}
                    className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] hover:bg-neutral-800"
                  >
                    Stop
                  </button>
                </div>
              )
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function LoopSummary(): React.JSX.Element {
  const s = useMiniOrk(mo.fleetSummary, 10_000)
  if (s.state !== 'ok') return <></>

  const verified = s.data.by_status.find((x) => x.status === 'pass')?.count ?? 0
  const total = s.data.by_status.reduce((a, x) => a + x.count, 0)

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div className="rounded-md border border-neutral-700/50 bg-neutral-900/40 p-2">
        <div className="text-[10px] uppercase tracking-wide opacity-50">Verified</div>
        <div className="font-mono text-sm">
          {verified}
          <span className="opacity-40">/{total}</span>
        </div>
      </div>
      <div className="rounded-md border border-neutral-700/50 bg-neutral-900/40 p-2">
        <div className="text-[10px] uppercase tracking-wide opacity-50">Spend</div>
        <div className="font-mono text-sm">${(s.data.total_cost_usd ?? 0).toFixed(2)}</div>
      </div>
    </div>
  )
}

function Compounding(): React.JSX.Element {
  const si = useMiniOrk(mo.selfImprove, 30_000)
  if (si.state !== 'ok' || si.data.length === 0) return <></>

  const recent = si.data.slice(0, 12).reverse()
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide opacity-50">
        Self-improvement iterations
      </div>
      <div className="flex items-end gap-0.5">
        {recent.map((r) => {
          const ok = (r.outcome ?? '').toLowerCase().includes('pass')
          return (
            <div
              key={r.run_id}
              title={`iter ${r.iter} — ${r.outcome ?? 'running'}`}
              className={`h-4 flex-1 rounded-sm ${ok ? 'bg-emerald-600/70' : 'bg-neutral-700/60'}`}
            />
          )
        })}
      </div>
    </div>
  )
}

export function CoevolvePanel(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 border-t border-neutral-800 p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-semibold tracking-wide">CO-EVOLVE</span>
        <span className="text-[10px] opacity-40">the loop</span>
      </div>
      <LoopSummary />
      <ActiveRuns />
      <Compounding />
    </div>
  )
}
