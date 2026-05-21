import type {
  TaskId,
  TaskDefinition,
  WorkflowState,
  CompiledPrompt,
  AgentResult,
  EventEntry,
  StatusReport,
} from "../types/harness-types.js";
import { add, load, updateState } from "../task-registry/taskRegistry.js";
import { append, readAppendOrder } from "../event-log/eventLog.js";
import { transition, deriveState } from "../state-machine/stateMachine.js";
import { authorize } from "../policy-gate/policyGate.js";
import { classify, shouldRetry, continuePrompt } from "../retry-manager/retryManager.js";

const MAX_ATTEMPTS = 3;

export async function executeTask(
  task: TaskDefinition,
  agentRun: (prompt: CompiledPrompt) => Promise<AgentResult>,
): Promise<{ taskId: TaskId; finalState: WorkflowState; events: readonly EventEntry[] }> {
  add(task);

  let state: WorkflowState = "NEW";
  state = transition(task.id, "task_registered", state);
  updateState(task.id, state);

  state = transition(task.id, "source_locked_agent_started", state);
  updateState(task.id, state);

  let prompt: CompiledPrompt = {
    taskId: task.id,
    content: task.description,
    context: [],
  };

  let attemptCount = 0;

  while (true) {
    let result: AgentResult;
    try {
      result = await agentRun(prompt);
    } catch (err) {
      result = {
        success: false,
        output: "",
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      };
    }

    attemptCount++;

    if (result.success) {
      state = transition(task.id, "agent_returned_success", state);
      updateState(task.id, state);
      break;
    }

    const classification = classify(result);

    if (classification === "transient") {
      state = transition(task.id, "agent_returned_retryable", state);
      updateState(task.id, state);

      if (shouldRetry(classification, attemptCount)) {
        state = transition(task.id, "retry_approved", state);
        updateState(task.id, state);
        prompt = continuePrompt(task.id, classification, result.output) ?? prompt;
      } else {
        state = transition(task.id, "retry_limit_exceeded", state);
        updateState(task.id, state);
        break;
      }
    } else {
      state = transition(task.id, "agent_returned_needs_human", state);
      updateState(task.id, state);
      break;
    }
  }

  const finalState = deriveState(task.id);
  return { taskId: task.id, finalState, events: readAppendOrder(task.id) };
}

export function getStatus(taskId: TaskId): StatusReport {
  const events = readAppendOrder(taskId);
  const state = deriveState(taskId);
  const lastEvent = events.length > 0 ? events[events.length - 1].event : undefined;
  return { taskId, state, eventCount: events.length, lastEvent };
}
