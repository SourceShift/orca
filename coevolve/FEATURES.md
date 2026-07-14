# Orca-as-ecosystem-UI — feature spec

The developer's single pane of glass over the co-evolution ecosystem: **mini-ork** (the
verified loop / brain), **ContextNest** (cross-session memory), **TraceOtter** (distill runs →
train a local student). Every feature below maps to a pitch-deck topic and to the backend that
feeds it. Built as companion panels over vanilla Orca (see `INTEGRATION.md`); Orca's own
strengths (worktrees, terminals, diffs, mobile, GitHub/Linear) are assumed and not re-listed.

Data sources: **MO** = mini-ork `serve` REST/SSE (:7090) + `mini-ork-mcp-steering` (control) ·
**CN** = ContextNest REST (:7048) · **TO** = TraceOtter · **exec** = Crucible/Assay verdicts.

---

## 0. The centerpiece — the Run Trajectory view

*Deck topic: "compounding autonomy / the data flywheel — run → judge → insight → memory →
better routing."* This is the one view the whole product hangs on: the closed loop, per run,
rendered as a connected graph you can walk.

| Feature | What the developer sees | Source |
|---|---|---|
| **Live loop graph** | classify → plan → execute → verify → reflect → learn, as nodes that light up as the run progresses (SSE) | MO |
| **Per-node drill-down** | for any node: prompt, chosen lane, output, cost, latency, verdict | MO |
| **The closed-loop overlay** | CN lessons injected at the top → the DAG of work → verdicts per node → gradients extracted (linked to the trace that justified them) → outcome posted back to CN → confidence delta | MO+CN |
| **Replay / scrub** | replay a completed run step by step; jump to the moment a verdict flipped | MO |

## 1. Verification & trust — "when it says done, it's done"

*Deck topics: the verified loop; honest failure over false completion; execution-anchored +
metamorphic (Crucible + Assay).*

- **Verdict badge** on every run/patch: `PROVEN` / `REFUTED` / `UNVERIFIED` — never a bare "pass".
- **The evidence panel** (the differentiator, made visible): the reproduction test (PoC+), the
  delta-gate result (red→green), the **metamorphic invariants** with per-invariant pass/fail, the
  isolated runtime it executed in. "Here is *why* we believe this fix is correct."
- **The abstention queue** — the `UNVERIFIED` set routed to a human. This is the product's honest
  edge: "we couldn't prove these; you decide." Sortable by why-it-abstained.
- **Trust dashboard** — verification precision + Wilson bound, false-completion count (the number
  that must be zero), hard-negatives-caught, recall/coverage. The live version of the pitch's
  headline number.
- **Raw-agent vs mini-ork contrast** — side-by-side "Codex claimed done on M%, right on m%;
  mini-ork claims done less, right on ~all." The claim-accuracy comparison.

## 2. Memory — what the system has learned (ContextNest)

*Deck topic: cross-session agent memory; the "insight → memory" arc of the flywheel.*

- **Lesson browser** — every promoted lesson: text, evidence (the trace that produced it),
  confidence, objective_domain, when last injected, hit/win rate.
- **Injection trace** — for a given run, which lessons were injected and whether they helped
  (outcome delta). Closes the "did memory pay off?" loop visibly.
- **Promotion gate** — candidate lessons awaiting promotion/demotion; approve/reject inline
  (the actor-blind distiller → judge-gate pipeline surfaced for a human).
- **Memory search** — semantic search over the lesson store; "what does the system know about X?"
- **Attention inbox** — CN's surfaced items needing a human (todos, user-actions) as a queue.

## 3. Learning & routing — the cost-aware brain

*Deck topics: heterogeneous model lanes; cost-aware routing (contextual bandit).*

- **Routing view** — per node, which lane was chosen (opus/sonnet/codex/kimi/minimax/glm) and
  **why**: the learned group-relative advantage that drove it, plus the exploration flag.
- **Lane leaderboard** — per (objective_domain, task_class, node_type) partition: which lane wins,
  its advantage, sample count, cost. "The system learned codex is best for X, kimi for Y."
- **The router flipping, live** — a before/after when accumulated reward changes the chosen lane
  for a partition. The learning made tangible.
- **Model-mix + cost split** — spend per lane, cost-per-verified-fix, cheap-lane-vs-expensive-lane
  ratio over time (the cost story: spend the expensive model only where it pays).

## 4. The compounding curve — the thesis, on a graph

*Deck topic: the fundability artifact — does the loop get better as it accumulates experience?*

- **Compounding-curve chart** — held-out resolve/precision, ON (learning) vs OFF (stateless
  baseline), across epochs, budget-matched. The rising gap *is* the pitch; render it front-and-center.
- **Per-cohort curves** — filter by repo / task_class / theme to show *where* it compounds.
- **Honesty band** — Wilson intervals on every point, so the curve is defensible, not decorative.

## 5. Training — distill & own the student (TraceOtter)

*Deck topic: TraceOtter — distill run trajectories → train a local student model.*

- **Trajectory harvest** — runs distilled into training data; count, quality, coverage by lane.
- **Training runs** — launched jobs, status, cost, checkpoints, the student-model version tree.
- **Held-out route accuracy** — the student's accuracy on a held-out eval vs the base model (gate
  on held-out, never train loss). The "72% vs 0% base" story, live.
- **Promote a checkpoint** — human gate to make a trained student the active router policy
  (blast-radius aware — see §6).

## 6. Self-improvement & governance — safe autonomy

*Deck topics: gated self-modification (framework-edit); GEPA prompt evolution; the apply loop.*

- **Proposed self-edits** — framework-edit's candidate changes to mini-ork's own code, each with a
  **blast-radius scope** and a one-command **rollback**. Auto-promote low-risk, human sign-off for
  policy/safety-touching (the tiered safety model).
- **GEPA prompt evolution** — candidate prompt mutations, held-out scores vs best-so-far, the
  accept/reject margin gate.
- **The apply loop** — learn → gradient → applied change, with the before/after and the eval that
  justified it. `MO_APPLY_ENABLED` state visible.
- **Governance log / ADR feed** — "we adopted X from run Y because held-out ↑Z", citation-linked.
  The audit trail that makes autonomy trustworthy to an enterprise buyer.

## 7. Adversarial verification panels

*Deck topic: multi-lens adversarial review.*

- **Panel view** — the reviewer lenses (correctness/security/repro/etc.), each verdict, and the
  **Krippendorff-α** agreement. Shows verification is a quorum, not one opinion.
- **Refute-or-promote trace** — how a finding survived (or died in) adversarial verification.

## 8. Developer workflow — dispatch, review, steer

*Cross-cutting: the daily loop a developer actually lives in.*

- **Dispatch a task** — write/attach a kickoff, pick scope, fire `mini-ork run` (as an Orca agent
  in a worktree). Templates that enforce the `## Success criteria` the classifier needs.
- **Steer mid-run** — inject guidance / operator_steering via the MCP control channel without
  killing the run.
- **Review & approve** — the diff + verdict + evidence in one view; approve → merge (Orca's native
  GitHub/PR flow), or reject with a reason (which becomes a lesson).
- **Real-repo proof mode** — run mini-ork against a target repo issue and show the honest outcome
  (verified fix, or "can't verify — here's why"), the anti-false-completion demo.
- **Budget & circuit breaker** — per-run/day spend, the cost ceiling, and the halt state, with an
  override.

## 9. Cross-cutting

- **Mobile companion** (Orca native) — approve abstentions, sign off self-edits, watch a run from a
  phone. The "governance from anywhere" story.
- **Ecosystem status** — health of mini-ork `:7090`, CN `:7048`, TraceOtter; lane quotas
  (kimi/minimax rate-limit state) so a stalled run is legible, not mysterious.
- **Search across everything** — one search over runs, lessons, traces, findings, training data.
- **Notifications** — run landed, verdict flipped, abstention needs you, self-edit awaiting sign-off,
  budget ceiling hit.

---

## Deck-topic → feature coverage map (nothing uncovered)

| Deck topic | Covered by |
|---|---|
| Problem: agents ship wrong patches | §1 trust dashboard, raw-vs-mini-ork contrast |
| The verified loop ("done means done") | §0 trajectory, §1 verdict + evidence panel |
| Honest failure > false completion | §1 abstention queue, §8 real-repo proof mode |
| Execution-anchored + metamorphic | §1 evidence panel (Crucible runtime + Assay invariants) |
| Heterogeneous lanes + cost routing | §3 routing view, lane leaderboard, cost split |
| Compounding autonomy / flywheel | §0 closed-loop overlay, §4 compounding curve |
| Cross-session memory | §2 lesson browser, injection trace, promotion gate |
| Distill & train the student | §5 all |
| Gated self-modification | §6 all |
| Adversarial verification | §7 all |
| Cost / budget control | §3 cost split, §8 budget & circuit breaker |
| Daily developer experience | §8 all, §9 mobile |

## Build order (what proves the pitch fastest)

1. **§0 Run Trajectory + §1 evidence panel + verdict badges** — the core demo; without this there is
   no product. All from MO :7090 (already built) — mostly *embed + connect*, little new UI.
2. **§1 trust dashboard + §4 compounding curve** — the two numbers the pitch lives on.
3. **§2 memory browser + §3 routing view** — the flywheel, made visible.
4. **§5 TraceOtter + §6 governance** — the moat depth for later-stage diligence.
5. **§7, §8 steer, §9 mobile** — polish and the enterprise-trust surfaces.
