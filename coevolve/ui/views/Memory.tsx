/**
 * The memory lane — ContextNest.
 *
 * This is the tab that CLOSES the loop. Every other tab shows mini-ork doing work:
 * run → verdict → gradient → bandit arm. This one shows where that work GOES —
 * what the system remembered, and what it now believes needs a human.
 *
 *   run → verify → judge → INSIGHT → MEMORY → better routing
 *                                     ^^^^^^
 * Without it, the panel shows a loop that spins. With it, a loop that compounds.
 */
import { useCallback, useState } from 'react'
import * as cn from '../api/contextnest'
import { useMiniOrk } from '../useMiniOrk'

function CnOffline(): React.JSX.Element {
  return (
    <div className="rounded-md border border-amber-600/40 bg-amber-950/30 p-2.5 text-[11px] text-amber-200">
      <div className="font-medium">ContextNest is not running.</div>
      <div className="mt-1 opacity-80">
        <code className="rounded bg-black/40 px-1">cd ~/ps/ContextNest && make dev-be</code>
      </div>
      <div className="mt-1 opacity-60">Serves :28080 (not :7048 — that is the z-dashboard).</div>
    </div>
  )
}

function num(n: number): string {
  return n.toLocaleString()
}

export function MemoryLaneView(): React.JSX.Element {
  const fetchStats = useCallback((s?: AbortSignal) => cn.stats(s), [])
  const fetchInbox = useCallback((s?: AbortSignal) => cn.inbox(s), [])
  const fetchFeatures = useCallback((s?: AbortSignal) => cn.features('24h', s), [])

  const st = useMiniOrk(fetchStats, 20_000)
  const ib = useMiniOrk(fetchInbox, 10_000)
  const ft = useMiniOrk(fetchFeatures, 30_000)

  const [q, setQ] = useState('')
  const [hits, setHits] = useState<cn.Fragment[] | null>(null)
  const [searching, setSearching] = useState(false)

  const search = useCallback(async (): Promise<void> => {
    if (!q.trim()) {
      return
    }
    setSearching(true)
    try {
      setHits(await cn.retrieve(q.trim(), 6))
    } catch {
      setHits([])
    } finally {
      setSearching(false)
    }
  }, [q])

  if (st.state === 'offline') {
    return <CnOffline />
  }

  return (
    <div className="flex flex-col gap-2">
      {/* what the system remembers */}
      {st.state === 'ok' && (
        <>
          <div className="grid grid-cols-2 gap-1 text-center">
            <div className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5">
              <div className="font-mono text-sm tabular-nums">{num(st.data.total_fragments)}</div>
              <div className="text-[9px] uppercase tracking-wide opacity-50">fragments</div>
            </div>
            <div className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5">
              <div className="font-mono text-sm tabular-nums">{num(st.data.total_sessions)}</div>
              <div className="text-[9px] uppercase tracking-wide opacity-50">sessions</div>
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            {Object.entries(st.data.by_kind)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([kind, n]) => {
                const max = Math.max(...Object.values(st.data.by_kind))
                return (
                  <div key={kind}>
                    <div className="flex items-baseline justify-between gap-2 text-[10px]">
                      <span className="truncate opacity-70">{kind}</span>
                      <span className="font-mono tabular-nums opacity-50">{num(n)}</span>
                    </div>
                    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-violet-600/70"
                        style={{ width: `${(n / max) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </>
      )}

      {/* semantic retrieval — what does the system already know about X? */}
      <div className="flex gap-1">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void search()
            }
          }}
          placeholder="Ask memory…"
          className="flex-1 rounded border border-neutral-700 bg-black/40 px-1.5 py-1 text-[11px] outline-none focus:border-neutral-500"
        />
        <button
          onClick={() => void search()}
          className="rounded border border-neutral-700 px-2 text-[10px] hover:bg-neutral-800"
        >
          {searching ? '…' : 'Ask'}
        </button>
      </div>

      {hits !== null && (
        <div className="flex flex-col gap-1">
          {hits.length === 0 ? (
            <div className="text-[10px] opacity-40">Nothing remembered about that.</div>
          ) : (
            hits.map((h) => (
              <div key={h.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[9px] uppercase tracking-wide opacity-40">
                    {String(h.metadata?.kind ?? 'fragment')}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] tabular-nums opacity-50">
                    {(h.similarity * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-0.5 line-clamp-3 text-[10px] opacity-80">{h.content}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* the attention queue — what memory thinks needs a human */}
      {ib.state === 'ok' && ib.data.items.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide opacity-50">
            Needs attention ({ib.data.items.length})
          </div>
          <div className="flex flex-col gap-1">
            {ib.data.items.slice(0, 6).map((i) => (
              <div key={i.id} className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5">
                <div className="line-clamp-2 text-[10px]">{i.content}</div>
                {i.kind ? (
                  <div className="mt-0.5 text-[9px] uppercase tracking-wide opacity-40">
                    {i.kind}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* what actually shipped — the other end of the loop */}
      {ft.state === 'ok' && ft.data.count > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide opacity-50">
            Shipped ({ft.data.count} / 24h)
          </div>
          <div className="flex flex-col gap-1">
            {ft.data.features.slice(0, 5).map((f, idx) => (
              <div
                key={`${f.session_id}-${idx}`}
                className="rounded border border-neutral-800 bg-neutral-900/40 p-1.5"
              >
                <div className="line-clamp-2 text-[10px]">{f.feature}</div>
                {f.layer ? (
                  <div className="mt-0.5 text-[9px] uppercase tracking-wide opacity-40">
                    {f.layer}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
