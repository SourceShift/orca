# The seam — why the integration is 17 lines and not a fork

## The measurement that decided the architecture

Taken on 2026-07-14 against `upstream/main` (`stablyai/orca`):

| | |
|---|---|
| upstream commits, last 7 days | **490** |
| upstream commits, last 30 days | **1,820** |
| file-touches, last 30 days | **16,949** |
| …of those, under `src/` | **14,484 (85%)** |

The original `INTEGRATION.md` estimated "~100 commits/week". The real figure is **490** —
understated by **5×**. A fork that edits `src/` therefore eats a **14,484-file/month**
conflict surface. For a solo founder that is not a hard project; it is an arithmetically
impossible one. It would consume all engineering time and ship nothing.

But the alternative in the original doc — three browser tabs pointed at localhost — is not
a product either. The deck's entire claim is a **connected** loop. Bolting three iframes
together demonstrates the opposite.

## The resolution: one cold seam

Instead of asking *"fork or bolt-on?"*, ask **"what is the smallest edit to `src/` that buys
full native integration?"**

Churn ranking of every candidate mount point (upstream commits / 30d):

| Mount point | commits/30d | verdict |
|---|---|---|
| `components/right-sidebar/` (where Orca's *own* AI panel lives) | **162** | 🔥 never patch |
| `shared/types.ts` | **84** | 🔥 never patch |
| `components/tab-bar/TabBar.tsx` | **20** | 🔥 avoid |
| `App.tsx` | 29 | avoid |
| `electron.vite.config.ts` | 6 | acceptable (1 line, stable block) |
| `browser-pane/webview-registry.ts` | 1 | cold |
| **`components/Sidebar.tsx`** | **0** | ✅ **the seam** |
| **`config/tsconfig.web.json`** | **0** | ✅ |

`Sidebar.tsx` is a one-line barrel (`export { default } from './sidebar/index'`). It is
**live** (imported by `App.tsx`) but takes **zero upstream commits**, precisely because it is
just a re-export. That makes it the perfect place to hang a wrapper: we get inside Orca's
renderer — real React, real state, no iframe — without touching a single file upstream cares
about.

## The patch series

| Patch | File | churn/30d | Lines |
|---|---|---|---|
| `0001-sidebar-mount` | `src/renderer/src/components/Sidebar.tsx` | 0 | 7 |
| `0002-vite-alias` | `electron.vite.config.ts` | 6 | 4 |
| `0003-tsconfig-path` | `config/tsconfig.web.json` | 0 | 6 |

**17 lines. Three files.** Everything else — the panel, the API clients, the whole
Co-Evolve UI — lives under `coevolve/`, which upstream will never touch.

## The rules

1. **Nothing in `src/` may import from `coevolve/` except `Sidebar.tsx`.** One seam, one
   import (`@coevolve/mount`). If a second import appears in `src/`, the architecture has
   failed and the rebase tax starts compounding.
2. **All Co-Evolve code goes in `coevolve/ui/`.** It is unlimited in size and costs nothing
   at rebase time.
3. **After any rebase, run `bash coevolve/rebase.sh`** — it re-applies the seam and fails
   loudly if upstream moved one. A silently-dropped seam means the panel just vanishes,
   which is the worst possible failure: it looks like it works.
4. **If a patch stops applying, that is the one case needing a human.** Re-add the seam by
   hand, then regenerate: `git diff -- <file> > coevolve/patches/000N-*.patch`.

## Why not upstream a plugin API?

Orca has no extension surface (`build-plugins/` is a Vite build plugin, not an add-on API),
so there is nothing to build against today. Contributing a real panel-registration API to
`stablyai/orca` would delete even these 17 lines — worth proposing once the integration has
proven itself. Until then, a 17-line seam on two zero-churn files is close enough to free.
