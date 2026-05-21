// Mindflow Delivery Harness — Shared Types
// slice-001-core-orchestrator

export type TaskId = string;

export type WorkflowState =
  | "NEW"
  | "SOURCE_LOCK"
  | "RUNNING_FAKE_AGENT"
  | "WAITING_RETRY"
  | "NEEDS_HUMAN"
  | "BLOCKED"
  | "DONE"
  | "READY_FOR_NEXT_SLICE";

export interface TaskDefinition {
  readonly id: TaskId;
  readonly description: string;
  readonly scope: string;
  readonly createdAt: string;
}

export interface TaskRecord {
  readonly definition: TaskDefinition;
  readonly state: WorkflowState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EventEntry {
  readonly taskId: TaskId;
  readonly timestamp: string;
  readonly event: string;
  readonly data: unknown;
}

export interface AgentResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly retryable?: boolean;
}

export type RetryClassification = "transient" | "permanent" | "needs_human";

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export interface ProposedAction {
  readonly type: string;
  readonly target: string;
  readonly taskId: TaskId;
}

export interface CompiledPrompt {
  readonly taskId: TaskId;
  readonly content: string;
  readonly context: readonly string[];
}

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

export interface StatusReport {
  readonly taskId?: TaskId;
  readonly state: WorkflowState;
  readonly eventCount: number;
  readonly lastEvent?: string;
}

export type ExitCode = 0 | 1;
