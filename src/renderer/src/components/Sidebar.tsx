// COEVOLVE SEAM — the only edit to Orca's renderer. See coevolve/patches/README.md.
// Upstream ships ~490 commits/week; 85% land in src/. This file has taken 0 upstream
// commits in 30 days, which is why the integration hangs here and nowhere else.
import Base from './sidebar/index'
import { withCoevolve } from '@coevolve/mount'

export default withCoevolve(Base)
