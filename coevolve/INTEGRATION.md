# Coevolve — Orca as the control plane for mini-ork + ContextNest + TraceOtter

Orca is the shell. **mini-ork is the brain**; ContextNest (memory) and TraceOtter
(distillation/training) sit behind it. This fork makes the whole learning loop —
run → verify → judge → insight → memory → better routing — visible and *steerable*
from inside Orca.

The integration is **natively mounted** (real React inside Orca's renderer, not an
iframe) and costs **17 lines** of upstream-facing patch.

---

## The architecture, and the measurement behind it

The previous version of this doc said: *never edit `src/`; integrate only through
browser tabs, so the fork stays rebasable.* That instinct was right about the danger
and wrong about the conclusion. Both halves are now measured.

**The danger is real, and worse than stated.** Against `upstream/main` on 2026-07-14:

| | |
|---|---|
| upstream commits, last 7 days | **490** (the old doc guessed ~100 — a 5× understatement) |
| file-touches, last 30 days | **16,949** |
| …under `src/` | **14,484 — 85%** |

A fork that edits `src/` broadly eats a 14,484-file/month conflict surface. For a small
team that is not difficult, it is impossible.

**But the browser-tab answer is not a product.** Three iframes pointed at localhost do not
demonstrate a *connected* loop; they demonstrate three disconnected services. The claim we
are making requires the loop to be visible as one thing.

**The resolution is neither.** We hang the entire integration on the coldest file in the
tree and keep everything else out of upstream's way:

```
        ┌─────────────────────── Orca (rebases cleanly on upstream) ────────────────────┐
        │                                                                                │
        │   Sidebar.tsx  ──1 import──►  @coevolve/mount   ◄── THE ONLY SEAM (0 churn)    │
        │                                     │                                          │
        │                              coevolve/ui/  (our React, unlimited, zero cost)   │
        │                                     │                                          │
        └─────────────────────────────────────┼──────────────────────────────────────────┘
                                              │  http + SSE
                        ┌─────────────────────┴──────────────────────┐
                        │                                             │
             mini-ork serve :7090                          ContextNest :28080
        (runs, DAG, verdicts, cost, gradients,              (memory, lessons, inbox)
         self-improve iterations, LIVE STEERING)
```

`src/renderer/src/components/Sidebar.tsx` is a one-line barrel that is **live** (imported by
`App.tsx`) yet has taken **0 upstream commits in 30 days** — precisely because it is only a
re-export. Wrapping it puts us *inside* the renderer with full access to Orca's state, at
effectively zero rebase cost. Full reasoning and the churn ranking of every candidate mount
point: [`patches/README.md`](patches/README.md).

---

## What is built

| Piece | Path | What it does |
|---|---|---|
| Seam | `coevolve/ui/mount.tsx` | HOC wrapping Orca's sidebar. The only thing `src/` knows about us. |
| Panel | `coevolve/ui/CoevolvePanel.tsx` | 12 tabs — the whole loop (below) |
| mini-ork client | `coevolve/ui/api/miniork.ts` + `types.ts` | Every path read off `mini_ork/web/routes/*.py` — **none guessed**. |
| ContextNest client | `coevolve/ui/api/contextnest.ts` | Every path read off ContextNest's `.route(...)` calls — **none guessed**. |
| Patch series | `coevolve/patches/*.patch` | 3 files, 17 lines. The whole upstream surface. |
| Rebase tool | `coevolve/rebase.sh` | Rebase + re-apply the seam; **fails loudly** if upstream moves one. |

### The 12 tabs — each a real mechanism, none mocked

| Tab | Shows |
|---|---|
| **Loop** | active runs + verdict + live **Steer/Stop** |
| **Bandit** | the router's learned lane policy (region rows over domain fallback) |
| **GEPA** | the funnel that matters: proposed → scored → **promoted** |
| **Lanes** | per-lane cost/success record + top failure modes |
| **Memory** | **ContextNest** — fragments by kind, semantic "Ask memory", attention queue, what shipped |
| **Fail** | failure memory by category |
| **Pattern** | clusters the system found in its own behaviour + suggested meta-ADRs |
| **Topo** | which panel shapes win, and what each costs per run |
| **Cond** | the conductor's **predicted vs realized** score — is it calibrated? |
| **Review** | pre-push review verdicts + critical issues |
| **R&D** | the arXiv loop, with the honest column: *read* vs actually `used_in_patch` |
| **Gates** | circuit breakers — why a run is silently not happening |

**Steering works.** `POST /api/v1/task-runs/{id}/steer` is wired to the panel, so Orca is a
*control plane* — you can redirect a live run from the sidebar — not a dashboard.

**The Memory tab is what closes the loop.** Every other tab shows mini-ork doing work
(run → verdict → gradient → bandit arm). Memory shows where that work *goes*, and what the
substrate now believes needs a human. Without it the panel shows a loop that spins; with it,
one that compounds.

### One rule inherited from mini-ork itself

An unreachable backend renders as **"offline"**, never as an empty list. A panel showing
"0 runs, all good" for a dead daemon is a vacuous pass at the UI layer — the same failure
mini-ork's verifier rejects at `mini_ork_verify.py:173` (exit 0 with no evidence → fail).
The same reasoning forced a **CORS fix** in mini-ork: an Electron renderer loads from
`file://` and sends `Origin: null`, which was blocked — and a CORS-blocked fetch is
indistinguishable from "no data".

---

## Setup

```bash
pnpm install                                  # Orca deps
mini-ork serve --port 7090                    # brain: runs, traces, steering  (verified live)
cd ~/ps/ContextNest && make dev-be           # memory: ContextNest on :28080
pnpm dev                                      # Orca, with the Co-Evolve panel in the sidebar
```

Optionally register the steering MCP server (`coevolve/mcp.example.json`) so agents inside
Orca can drive mini-ork directly.

## Rebase discipline

```bash
bash coevolve/rebase.sh            # fetch + rebase upstream + re-apply the seam + verify
bash coevolve/rebase.sh --check    # verify the seam is intact; change nothing
```

1. **Only `Sidebar.tsx` may import from `coevolve/`.** One seam, one import. A second import
   in `src/` means the architecture has failed and the rebase tax begins compounding.
2. **All new Co-Evolve code goes under `coevolve/ui/`** — unlimited, free at rebase time.
3. **Always run `rebase.sh` after a rebase.** A silently-dropped seam makes the panel simply
   vanish, which is the worst failure mode: it looks like it works.

## Verified state (2026-07-14)

- ✅ Renderer typecheck: **0 errors** in `coevolve/` + the seam. oxlint clean.
- ✅ Seam check: 3/3 files intact, **17 lines**
- ✅ `mini-ork serve` :7090 — all endpoints **HTTP 200** with real data: 26 bandit arms,
  6,587 gradients, 4 promotions (3 accepted), 2,272 traces, 4,362 LLM calls
- ✅ **ContextNest :28080** — live: **420,111 fragments / 11,411 sessions**, inbox +
  semantic retrieval + shipped-features all answering
- ⚠️ **Node must be `<25`** (`nvm use 22.23.1`). Orca pins `>=22.13 <25`; on Node 25 the
  main-process build fails.
- ⚠️ `electron-vite build` trips Orca's daemon-entry smoke guard on `node-pty`
  (**pre-existing**, reproduces without our patches). The renderer builds clean.

### Ports — get these right

| Service | Port | Note |
|---|---|---|
| mini-ork serve | **7090** | runs, traces, learning, steering |
| ContextNest | **28080** | memory. **NOT 7048** — an earlier version of this doc said 7048; that is the *z-dashboard* daemon and nothing ContextNest listens there. |
