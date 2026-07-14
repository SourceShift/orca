import { useEffect, useState } from 'react'
import { MiniOrkOffline } from './api/miniork'

export type Load<T> = { state: 'loading' } | { state: 'offline' } | { state: 'ok'; data: T }

/**
 * Poll a mini-ork endpoint.
 *
 * `offline` is a DISTINCT state from empty data, deliberately. A dead daemon must
 * never render as "0 runs, all good" — that is a vacuous pass at the UI layer, the
 * same failure mini_ork_verify.py:173 rejects (exit 0 with no evidence → fail).
 */
export function useMiniOrk<T>(fetcher: (s?: AbortSignal) => Promise<T>, pollMs = 5000): Load<T> {
  const [v, setV] = useState<Load<T>>({ state: 'loading' })

  useEffect(() => {
    let alive = true
    const ac = new AbortController()

    const tick = async (): Promise<void> => {
      try {
        const data = await fetcher(ac.signal)
        if (alive) {
          setV({ state: 'ok', data })
        }
      } catch (e) {
        if (!alive || ac.signal.aborted) {
          return
        }
        if (e instanceof MiniOrkOffline) {
          setV({ state: 'offline' })
        } else {
          setV({ state: 'offline' })
        }
      }
    }

    void tick()
    const id = setInterval(() => void tick(), pollMs)
    return () => {
      alive = false
      ac.abort()
      clearInterval(id)
    }
  }, [fetcher, pollMs])

  return v
}
