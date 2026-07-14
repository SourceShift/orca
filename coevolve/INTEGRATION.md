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
             mini-ork serve :7090                          ContextNest :7048
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
| Panel | `coevolve/ui/CoevolvePanel.tsx` | The loop in one view: verified/total, spend, active runs, self-improve iterations |
| API client | `coevolve/ui/api/miniork.ts` | Typed client. Every path read off `mini_ork/web/routes/*.py` — **none guessed**. |
| Patch series | `coevolve/patches/*.patch` | 3 files, 17 lines. The whole upstream surface. |
| Rebase tool | `coevolve/rebase.sh` | Rebase + re-apply the seam; **fails loudly** if upstream moves one. |

**Steering works.** `POST /api/v1/task-runs/{id}/steer` is wired to the panel, so Orca is a
*control plane* — you can redirect a live run from the sidebar — not a dashboard.

### One rule inherited from mini-ork itself

An unreachable backend renders as **"offline"**, never as an empty list. A panel showing
"0 runs, all good" for a dead daemon is a vacuous pass at the UI layer — the same failure
mini-ork's verifier rejects at `mini_ork_verify.py:173` (exit 0 with no evidence → fail).

---

## Setup

```bash
pnpm install                                  # Orca deps
mini-ork serve --port 7090                    # brain: runs, traces, steering  (verified live)
# ContextNest daemon serves :7048             # memory  (start separately)
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

- ✅ Renderer typecheck: **0 errors** in `coevolve/` + the seam
- ✅ Seam check: 3/3 files intact, 17 lines
- ✅ `mini-ork serve` live: `/health`, `/runs/active`, `/task-runs/summary`,
  `/trajectory/self-improve` all **HTTP 200** with real data (88 runs, $182.03 spend,
  self-improve at iteration 39)
- ⚠️ ContextNest `:7048` was **not running** at time of writing — the memory lane of the
  panel is unbuilt until it is up.
