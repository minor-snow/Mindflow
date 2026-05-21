export type TaskId = string;

export type WorkflowState =
  | "NEW"
  | "SOURCE_LOCK"
  | "RUNNING_FAKE_AGENT"
  | "WAITING_RETRY"
  | "NEEDS_HUMAN"
  | "DONE"
  | "BLOCKED"
  | "READY_FOR_NEXT_SLICE";

export type WorkflowEvent =
  | "task_registered"
  | "source_locked_agent_started"
  | "agent_returned_retryable"
  | "agent_returned_needs_human"
  | "agent_returned_success"
  | "policy_gate_blocked"
  | "retry_approved"
  | "retry_limit_exceeded"
  | "human_approved_continue"
  | "human_rejected"
  | "unblock_requested"
  | "outputs_verified";

export interface TaskDefinition {
  id: TaskId;
  description: string;
  scope: string;
  createdAt: string;
}

export interface TaskRecord {
  taskId: TaskId;
  definition: TaskDefinition;
  state: WorkflowState;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventEntry {
  eventId: string;
  taskId: TaskId;
  timestamp: string;
  event: WorkflowEvent;
  actor: string;
  data: Record<string, unknown>;
}

export interface AgentResult {
  success: boolean;
  output?: string;
  error?: string;
  retryable?: boolean;
}

export type RetryClassification =
  | "transient"
  | "hard"
  | "needs_human"
  | "success";

export type PolicyDecision = "allow" | "requires_human" | "block";

export interface ProposedAction {
  action: string;
  [key: string]: unknown;
}

export interface CompiledPrompt {
  taskId: TaskId;
  content: string;
  context: Record<string, unknown>;
}

export interface StatusReport {
  taskId: TaskId;
  state: WorkflowState;
  retryCount: number;
  eventCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ExitCode = 0 | 1 | 2;

export interface PolicyRule {
  id: string;
  action_pattern: string;
  decision: PolicyDecision;
  severity: "hard" | "soft";
  reason: string;
}

export interface MetricsReport {
  taskId: TaskId;
  evaluatedAt: string;
  invalid_transition_count: number;
  policy_bypass_attempt_count: number;
  event_log_rewrite_count: number;
  transient_error_misroute_count: number;
  forbidden_dependency_count: number;
  expected_output_completion_ratio: number;
}

export interface PromptContext {
  taskRecord: TaskRecord;
  recentEvents: readonly EventEntry[];
  briefing: Briefing | null;
  [key: string]: unknown;
}

export interface Briefing {
  taskId: TaskId;
  content: string;
  metadata?: Record<string, unknown>;
}
