import type { TaskId, TaskDefinition, WorkflowState, StatusReport, EventEntry } from "../types/harness-types.js";
import type { AgentAdapter } from "../adapters/agentAdapter.js";
import * as taskRegistry from "../task-registry/taskRegistry.js";
import * as stateMachine from "../state-machine/stateMachine.js";
import * as eventLog from "../event-log/eventLog.js";
import * as metricsCollector from "../observation/metricsCollector.js";
import * as retryManager from "../retry-manager/retryManager.js";
import * as promptCompiler from "../prompt-compiler/promptCompilerStub.js";

export interface ExecuteResult {
  taskId: TaskId;
  finalState: WorkflowState;
  eventCount: number;
}

export interface ExtendedStatusReport extends StatusReport {
  lastEvent: EventEntry | null;
}

export async function executeTask(
  taskDef: Omit<TaskDefinition, "id"> & { id?: TaskId },
  adapter: AgentAdapter,
): Promise<ExecuteResult> {
  const taskId = taskRegistry.add(taskDef);

  let state = stateMachine.transition(taskId, "task_registered", "NEW");
  taskRegistry.updateState(taskId, state);

  state = stateMachine.transition(taskId, "source_locked_agent_started", "SOURCE_LOCK");
  taskRegistry.updateState(taskId, state);

  while (state === "RUNNING_FAKE_AGENT") {
    const record = taskRegistry.load(taskId)!;
    const prompt = promptCompiler.compile(taskId, record.definition.description);
    const result = await adapter.run(prompt);

    if (result.success) {
      state = stateMachine.transition(taskId, "agent_returned_success", "RUNNING_FAKE_AGENT");
      taskRegistry.updateState(taskId, state);
      break;
    }

    const classification = retryManager.classify(result);

    if (classification === "transient") {
      const retryCount = taskRegistry.incrementRetry(taskId);
      state = stateMachine.transition(taskId, "agent_returned_retryable", "RUNNING_FAKE_AGENT");
      taskRegistry.updateState(taskId, state);

      if (retryCount < retryManager.MAX_RETRIES) {
        state = stateMachine.transition(taskId, "retry_approved", "WAITING_RETRY");
        taskRegistry.updateState(taskId, state);
      } else {
        state = stateMachine.transition(taskId, "retry_limit_exceeded", "WAITING_RETRY");
        taskRegistry.updateState(taskId, state);
        break;
      }
    } else {
      // hard or needs_human — both require human review
      state = stateMachine.transition(taskId, "agent_returned_needs_human", "RUNNING_FAKE_AGENT");
      taskRegistry.updateState(taskId, state);
      break;
    }
  }

  metricsCollector.writeMetrics(taskId);

  return {
    taskId,
    finalState: state,
    eventCount: eventLog.count(taskId),
  };
}

export function approveTask(taskId: TaskId): void {
  const record = taskRegistry.load(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);
  if (record.state !== "NEEDS_HUMAN") {
    throw new Error(`approveTask requires state NEEDS_HUMAN, got: ${record.state}`);
  }
  const nextState = stateMachine.transition(taskId, "human_approved_continue", "NEEDS_HUMAN");
  taskRegistry.updateState(taskId, nextState);
}

export function retryTask(taskId: TaskId): void {
  const record = taskRegistry.load(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);
  if (record.state !== "WAITING_RETRY") {
    throw new Error(`retryTask requires state WAITING_RETRY, got: ${record.state}`);
  }
  const nextState = stateMachine.transition(taskId, "retry_approved", "WAITING_RETRY");
  taskRegistry.updateState(taskId, nextState);
}

export function getStatus(taskId: TaskId): ExtendedStatusReport {
  const record = taskRegistry.load(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);
  const events = eventLog.readAppendOrder(taskId);
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;
  return {
    taskId: record.taskId,
    state: record.state,
    retryCount: record.retryCount,
    eventCount: events.length,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastEvent,
  };
}
