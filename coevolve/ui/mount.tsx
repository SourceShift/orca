/**
 * The single seam.
 *
 * This HOC is the ONLY thing upstream Orca code knows about Co-Evolve. It wraps
 * the sidebar barrel (src/renderer/src/components/Sidebar.tsx — 0 upstream commits
 * in 30 days) and renders our panel beneath the vanilla sidebar.
 *
 * Why here and not in components/right-sidebar/: that directory takes ~162 upstream
 * commits/month (it is where Orca's own AI panel lives). Patching a hot file means
 * merge conflicts forever. Patching a 1-line barrel that never changes means the
 * rebase tax is ~zero. See coevolve/patches/README.md.
 *
 * Rule: nothing in src/ may import anything from coevolve/ except this file.
 */
import type { ComponentType } from 'react'
import { CoevolvePanel } from './CoevolvePanel'

class PanelBoundary extends Error {}

/**
 * Wrap any component so the Co-Evolve panel renders after it.
 *
 * Generic over the wrapped component's props so the patch site stays type-safe
 * without knowing Orca's Sidebar signature — which upstream is free to change.
 */
export function withCoevolve<P extends object>(Base: ComponentType<P>): ComponentType<P> {
  const Wrapped = (props: P): React.JSX.Element => (
    <>
      <Base {...props} />
      <CoevolvePanel />
    </>
  )
  Wrapped.displayName = `withCoevolve(${Base.displayName ?? Base.name ?? 'Component'})`
  return Wrapped
}

export { CoevolvePanel, PanelBoundary }
