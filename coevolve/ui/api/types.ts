/**
 * Response shapes for mini-ork's HTTP surface.
 *
 * Every field was read off the SELECT lists in mini_ork/web/routes/*.py and the
 * column names in PRAGMA table_info — none are guessed. Split out of miniork.ts to
 * keep that file under Orca's 300-line lint cap.
 */

export type ActiveRun = {
  id: string
  epic_id: string | null
  run_dir: string | null
  branch: string | null
  agent: string | null
  started_at: string | null
  /** 'runs' | 'task_runs' — which table this row came from */
  source: string
  task_run_id: string | null
  status: string | null
}
export type TaskRun = {
  id: string
  parent_epic_id: string | null
  task_class: string | null
  recipe: string | null
  status: string | null
  verdict: string | null
}
export type FleetSummary = {
  by_recipe: { recipe: string; count: number; cost: number | null }[]
  by_status: { status: string; count: number }[]
  total_cost_usd: number
}
export type SelfImproveRun = {
  run_id: string
  iter: number
  outcome: string | null
  started_at: string | null
  finished_at: string | null
  parent_run_id: string | null
  branch_name: string | null
  notes: string | null
}
export type CostByDay = {
  day: string
  cost_usd: number
}
export type LearningSummary = {
  bandit_arms: number
  gradients: number
  promotions: number
  /** promotions whose decision actually ACCEPTED the candidate */
  promoted: number
  prompt_versions_scored: number
  failures: number
  patterns: number
  topologies: number
  open_circuit_breakers: number
  traces: number
  llm_calls: number
}
/** One arm of the contextual bandit — a lane's learned advantage in a context. */
export type BanditArm = {
  agent_version_id: string
  task_class: string | null
  node_type: string | null
  objective_domain: string | null
  /** present only on region rows (the finer partition) */
  code_region?: string | null
  relative_advantage: number
  runs_count: number
  success_count: number
  last_updated: string | null
}
export type PromptWinRate = {
  prompt_version_hash: string
  task_class: string | null
  node_type: string | null
  agent_role: string | null
  wins: number
  losses: number
  ties: number
  win_rate: number
  sample_size: number
}
export type Promotion = {
  promotion_id: string
  candidate_id: string | null
  from_version_id: string | null
  to_version_id: string | null
  utility_before: number | null
  utility_after: number | null
  rationale: string | null
  decision: string | null
  decided_at: string | null
  decided_by: string | null
}
export type Failure = {
  failure_id: string
  run_id: string | number | null
  workflow_stage: string | null
  failure_category: string | null
  error_message: string | null
  occurred_at: string | null
}
export type Pattern = {
  pattern_id: string
  cluster_label: string | null
  strength_score: number | null
  suggested_meta_adr: string | null
  status: string | null
  detected_at: string | null
}
export type TopologyWinRate = {
  topology_id: string
  workflow_name: string | null
  task_class: string | null
  wins: number
  losses: number
  ties: number
  win_rate: number
  sample_size: number
  avg_cost_usd: number | null
  avg_duration_ms: number | null
}
export type CircuitBreaker = {
  scope_key: string
  state: string
  opened_at: string | null
  last_reason: string | null
  trip_count: number
  updated_at: string | null
}
export type AgentPerf = {
  agent_version_id: string
  role: string | null
  model: string | null
  task_class: string | null
  runs_count: number
  success_count: number
  avg_cost_usd: number | null
  avg_duration_ms: number | null
  top_failure_modes: string | null
  relative_advantage: number | null
}
export type GroundedRejection = {
  id: number
  run_id: string | number | null
  gate_name: string | null
  verdict: string | null
  concern: string | null
  evidence_summary: string | null
  suggestion: string | null
  ts: string | number | null
}
export type Review = {
  id: number
  reviewed_at: string | number | null
  source_sha: string | null
  target_branch: string | null
  verdict: string | null
  files_changed: number | null
  issues_open: number | null
  issues_critical: number | null
  cost_usd: number | null
  rationale: string | null
}
export type ReviewIssue = {
  id: number
  review_id: number
  lens: string | null
  severity: string | null
  file_path: string | null
  line_no: number | null
  title: string | null
  status: string | null
}
export type ConductorDecision = {
  id: number
  decided_at: string | number | null
  epic_id: string | null
  task_class: string | null
  chosen_topology: string | null
  chosen_recipe: string | null
  chosen_lane_hints: string | null
  predicted_score: number | null
  realized_score: number | null
  budget_pct_used: number | null
  rationale: string | null
  outcome: string | null
}
export type ArxivRef = {
  id: number
  run_id: string | null
  arxiv_id: string
  title: string | null
  technique: string | null
  mapped_file: string | null
  confidence: number | null
  /** the honest column: reading a paper is not learning from it */
  used_in_patch: number | null
  created_at: string | null
}
