import type { TaskId, WorkflowState, WorkflowEvent } from "../types/index.js";
import * as eventLog from "../event-log/index.js";

const TRANSITIONS: ReadonlyMap<WorkflowState, ReadonlyMap<WorkflowEvent, WorkflowState>> = new Map([
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
  ["READY_FOR_NEXT_SLICE", new Map()],
]);

export function transition(
  taskId: TaskId,
  event: WorkflowEvent,
  currentState: WorkflowState,
): WorkflowState {
  const stateTransitions = TRANSITIONS.get(currentState);
  const nextState = stateTransitions?.get(event);

  if (nextState === undefined) {
    throw new Error(
      `Invalid transition: state="${currentState}" event="${event}"`,
    );
  }

  eventLog.append({
    taskId,
    timestamp: new Date().toISOString(),
    event,
    data: { from: currentState, to: nextState },
  });

  return nextState;
}

export function deriveState(taskId: TaskId): WorkflowState {
  const entries = eventLog.readAppendOrder(taskId);

  if (entries.length === 0) {
    return "NEW";
  }

  let state: WorkflowState = "NEW";

  for (const entry of entries) {
    const stateTransitions = TRANSITIONS.get(state);
    const nextState = stateTransitions?.get(entry.event as WorkflowEvent);

    if (nextState !== undefined) {
      state = nextState;
    }
  }

  return state;
}
