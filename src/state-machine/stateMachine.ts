import type { WorkflowState, WorkflowEvent, TaskId } from "../types/harness-types.js";
import * as eventLog from "../event-log/eventLog.js";

const TRANSITIONS = new Map<WorkflowState, Map<WorkflowEvent, WorkflowState>>([
  ["NEW", new Map<WorkflowEvent, WorkflowState>([
    ["task_registered", "SOURCE_LOCK"],
  ])],
  ["SOURCE_LOCK", new Map<WorkflowEvent, WorkflowState>([
    ["source_locked_agent_started", "RUNNING_FAKE_AGENT"],
  ])],
  ["RUNNING_FAKE_AGENT", new Map<WorkflowEvent, WorkflowState>([
    ["agent_returned_retryable", "WAITING_RETRY"],
    ["agent_returned_needs_human", "NEEDS_HUMAN"],
    ["agent_returned_success", "DONE"],
    ["policy_gate_blocked", "BLOCKED"],
  ])],
  ["WAITING_RETRY", new Map<WorkflowEvent, WorkflowState>([
    ["retry_approved", "RUNNING_FAKE_AGENT"],
    ["retry_limit_exceeded", "NEEDS_HUMAN"],
  ])],
  ["NEEDS_HUMAN", new Map<WorkflowEvent, WorkflowState>([
    ["human_approved_continue", "RUNNING_FAKE_AGENT"],
    ["human_rejected", "BLOCKED"],
  ])],
  ["BLOCKED", new Map<WorkflowEvent, WorkflowState>([
    ["unblock_requested", "NEEDS_HUMAN"],
  ])],
  ["DONE", new Map<WorkflowEvent, WorkflowState>([
    ["outputs_verified", "READY_FOR_NEXT_SLICE"],
  ])],
]);

export function transition(
  taskId: TaskId,
  event: WorkflowEvent,
  currentState: WorkflowState,
): WorkflowState {
  const nextState = TRANSITIONS.get(currentState)?.get(event);
  if (nextState === undefined) {
    throw new Error(`Invalid transition: ${currentState} + ${event}`);
  }
  eventLog.append(taskId, event, "state_machine");
  return nextState;
}

export function deriveState(taskId: TaskId): WorkflowState {
  const events = eventLog.readAppendOrder(taskId);
  let state: WorkflowState = "NEW";
  for (const entry of events) {
    const nextState: WorkflowState | undefined = TRANSITIONS.get(state)?.get(entry.event);
    if (nextState !== undefined) {
      state = nextState;
    }
  }
  return state;
}

export function isValidTransition(from: WorkflowState, event: WorkflowEvent): boolean {
  return TRANSITIONS.get(from)?.has(event) ?? false;
}
