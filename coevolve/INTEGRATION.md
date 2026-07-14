# Coevolve integration — Orca as the control plane for mini-ork + ContextNest + TraceOtter

This fork adds a control-plane integration on top of Orca **without modifying Orca's core**,
so it can keep rebasing on upstream (which ships ~100 commits/week). Everything here lives
under `coevolve/`; no file in `src/` is touched.

## Why not a hard fork of the core

Orca ships ~14 commits/day across an Electron + iOS + Android monorepo. Editing its renderer
or main process to add native panels means either a daily rebase against that firehose, or
freezing at a snapshot and losing every upstream improvement. Neither is viable for a small
team. Instead we integrate at the seams Orca already exposes.

## Architecture — one brain, two backends behind it

```
        ┌──────────────────────────── Orca (vanilla, auto-updates) ───────────────────────────┐
        │                                                                                       │
        │   MCP client  ──stdio──►  mini-ork-mcp-steering        (control: steer/dispatch)      │
        │   Browser tab ──http──►   mini-ork serve  :7090        (Run Trajectory: runs/traces)  │
        │   Browser tab ──http──►   ContextNest      :7048        (memory: lessons/inbox)         │
        │   CLI agent   ──pty───►   bin/mini-ork run <kickoff>   (run work in a worktree)        │
        │                                                                                       │
        └───────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                    mini-ork is the single brain; ContextNest (memory) and
                    TraceOtter (distillation/training) sit BEHIND it.
```

This matches the standing design: Orca is a **thin control plane** over mini-ork; the whole
learning loop (run → judge → insight → memory → better routing) is rendered by stitching
mini-ork's own observability UI together with ContextNest's memory view.

## The four integration surfaces (all already exist)

| # | Surface | What it is | How Orca uses it | Status |
|---|---------|-----------|------------------|--------|
| 1 | `mini-ork-mcp-steering` | stdio MCP server, JSON-RPC 2.0, exposes `operator_steering` as a tool | add to Orca's MCP config (`mcpServers`) → steer/inject from Orca | **ready** |
| 2 | `mini-ork serve` `:7090` | React SPA + REST/SSE over `state.db` (runs, nodes, traces, rewards) | embed as a browser tab / webview | **ready** |
| 3 | ContextNest `:7048` | REST API (features, inbox, lessons) | embed as a browser tab / hit via http | **ready** (live) |
| 4 | `bin/mini-ork run` | the CLI loop (classify→plan→execute→verify→reflect) | run as an Orca CLI agent in a worktree | **ready** |

## What to BUILD (the only non-config work)

The four surfaces above give **control + visibility today** with zero core edits. The one
thing missing for "the whole learning loop in a single view" is a **companion panel** that
unifies them — a small standalone web app (`coevolve-panels`, separate repo) that:

- reads mini-ork `:7090` REST/SSE for the Run Trajectory,
- reads ContextNest `:7048` for the memory/inbox lane,
- surfaces TraceOtter training/eval state (via mini-ork or a thin TraceOtter endpoint),
- and renders them as one connected "co-evolution" view (run → judge → insight → memory → routing).

Orca embeds this companion as a browser tab. Because it is a *separate app*, it never touches
Orca's fork path — Orca stays vanilla and rebasable.

## Setup

1. Register the mini-ork steering MCP server in Orca — see `coevolve/mcp.example.json`.
2. Start the backends:
   ```
   mini-ork serve --port 7090          # Run Trajectory UI + REST/SSE
   # ContextNest daemon already serves :7048
   ```
3. Add `http://127.0.0.1:7090` and `http://127.0.0.1:7048` as Orca browser tabs.
4. (Later) build + embed `coevolve-panels` for the unified view.

## Rebase discipline

- Never edit `src/`, `mobile/`, or `native/`. Keep all additions under `coevolve/`.
- `git remote add upstream https://github.com/stablyai/orca && git fetch upstream && git rebase upstream/main`
  should always be clean, because our changes don't overlap theirs.
