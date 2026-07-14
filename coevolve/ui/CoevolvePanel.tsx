/**
 * The Co-Evolve panel — the whole mini-ork loop, natively inside Orca's renderer.
 *
 * Tabs map 1:1 onto the loop:
 *   LOOP     run → verdict → cost, with live steering (control, not just view)
 *   BANDIT   the router's learned policy — which lane is trusted with which work
 *   GEPA     prompt evolution: proposed → scored → PROMOTED
 *   FAIL     failure memory, by category
 *   PATTERN  what the system noticed about its own behaviour
 *   TOPO     which review-panel shapes win, and what they cost
 *   GATES    circuit breakers — why a run silently isn't happening
 */
import { useCallback, useState } from 'react'
import * as mo from './api/miniork'
import { useMiniOrk } from './useMiniOrk'
import {
  BanditView,
  BreakersView,
  FailuresView,
  GepaView,
  Offline,
  PatternsView,
  TopologyView
} from './views/Brain'
import { ConductorView, MemoryView, ResearchView, ReviewView } from './views/Brain2'

type Tab =
  | 'loop'
  | 'bandit'
  | 'gepa'
  | 'memory'
  | 'fail'
  | 'pattern'
  | 'topo'
  | 'cond'
  | 'review'
  | 'rnd'
  | 'gates'

const TABS: { id: Tab; label: string }[] = [
  { id: 'loop', label: 'Loop' },
  { id: 'bandit', label: 'Bandit' },
  { id: 'gepa', label: 'GEPA' },
  { id: 'memory', label: 'Memory' },
  { id: 'fail', label: 'Fail' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'topo', label: 'Topo' },
  { id: 'cond', label: 'Cond' },
  { id: 'review', label: 'Review' },
  { id: 'rnd', label: 'R&D' },
  { id: 'gates', label: 'Gates' }
]

function Verdict({ verdict }: { verdict: string | null }): React.JSX.Element {
  const v = (verdict ?? '').toLowerCase()
  const tone =
    v === 'pass'
      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/40'
      : v === 'fail' || v === 'needs_revision'
        ? 'bg-red-950/40 text-red-300 border-red-700/40'
        : 'bg-neutral-800/60 text-neutral-400 border-neutral-700/50'
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${tone}`}
    >
      {verdict ?? 'unverified'}
    </span>
  )
}

/** Active runs + live steering. This is what makes Orca a control plane. */
function LoopView(): React.JSX.Element {
  const fetchRuns = useCallback((s?: AbortSignal) => mo.activeRuns(s), [])
  const fetchSum = useCallback((s?: AbortSignal) => mo.learningSummary(s), [])
  const runs = useMiniOrk(fetchRuns, 4000)
  const sum = useMiniOrk(fetchSum, 15_000)

  const [steering, setSteering] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const send = useCallback(
    async (id: string): Promise<void> => {
      if (!msg.trim()) {
        return
      }
      await mo.steer(id, msg.trim())
      setMsg('')
      setSteering(null)
    },
    [msg]
  )

  if (runs.state === 'offline') {
    return <Offline />
  }

  return (
    <div className="flex flex-col gap-2">
      {sum.state === 'ok' && (
        <div className="grid grid-cols-3 gap-1 text-center">
          {[
            ['traces', sum.data.traces],
            ['gradients', sum.data.gradients],
            ['arms', sum.data.bandit_arms]
          ].map(([l, n]) => (
            <div
              key={l as string}
              className="rounded border border-neutral-800 bg-neutral-900/40 p-1"
            >
              <div className="font-mono text-[12px] tabular-nums">{n as number}</div>
              <div className="text-[9px] uppercase tracking-wide opacity-50">{l as string}</div>
            </div>
          ))}
        </div>
      )}

      {sum.state === 'ok' && sum.data.open_circuit_breakers > 0 && (
        <div className="rounded border border-red-700/50 bg-red-950/30 p-1.5 text-[10px] text-red-300">
          {sum.data.open_circuit_breakers} circuit breaker
          {sum.data.open_circuit_breakers === 1 ? '' : 's'} OPEN — runs are being blocked.
        </div>
      )}

      {runs.state === 'ok' && runs.data.length === 0 && (
        <div className="text-[11px] opacity-40">No active runs. mini-ork is idle.</div>
      )}

      {runs.state === 'ok' &&
        runs.data.map((r) => {
          const id = r.task_run_id ?? r.id
          return (
            <div key={id} className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-[11px]">
                  {r.branch ?? id.slice(0, 14)}
                </span>
                <Verdict verdict={r.status} />
              </div>
              <div className="mt-0.5 truncate text-[10px] opacity-50">{r.agent ?? 'agent'}</div>

              {r.task_run_id ? (
                steering === id ? (
                  <div className="mt-1.5 flex gap-1">
                    <input
                      autoFocus
                      value={msg}
                      onChange={(e) => setMsg(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void send(id)
                        }
                        if (e.key === 'Escape') {
                          setSteering(null)
                        }
                      }}
                      placeholder="Steer this run…"
                      className="flex-1 rounded border border-neutral-700 bg-black/40 px-1.5 py-1 text-[11px] outline-none focus:border-neutral-500"
                    />
                    <button
                      onClick={() => void send(id)}
                      className="rounded bg-neutral-700 px-2 text-[10px] hover:bg-neutral-600"
                    >
                      Send
                    </button>
                  </div>
                ) : (
                  <div className="mt-1.5 flex gap-1">
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

export function CoevolvePanel(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('loop')

  return (
    <div className="flex flex-col gap-2 border-t border-neutral-800 p-2.5">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold tracking-wide">CO-EVOLVE</span>
        <span className="text-[9px] opacity-40">mini-ork</span>
      </div>

      <div className="flex flex-wrap gap-0.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              tab === t.id
                ? 'bg-neutral-700 text-neutral-100'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-[46vh] overflow-y-auto pr-0.5">
        {tab === 'loop' && <LoopView />}
        {tab === 'bandit' && <BanditView />}
        {tab === 'gepa' && <GepaView />}
        {tab === 'fail' && <FailuresView />}
        {tab === 'pattern' && <PatternsView />}
        {tab === 'topo' && <TopologyView />}
        {tab === 'memory' && <MemoryView />}
        {tab === 'cond' && <ConductorView />}
        {tab === 'review' && <ReviewView />}
        {tab === 'rnd' && <ResearchView />}
        {tab === 'gates' && <BreakersView />}
      </div>
    </div>
  )
}
