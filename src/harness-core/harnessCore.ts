import type { TaskId, TaskDefinition, WorkflowState, StatusReport } from "../types/harness-types.js";
import * as taskRegistry from "../task-registry/taskRegistry.js";
import * as eventLog from "../event-log/eventLog.js";
import { transition, deriveState } from "../state-machine/stateMachine.js";
import { authorize } from "../policy-gate/policyGate.js";
import { classify, shouldRetry, continuePrompt, MAX_RETRIES } from "../retry-manager/retryManager.js";
import { compile } from "../prompt-compiler/promptCompilerStub.js";
import * as metrics from "../observation/metricsCollector.js";
import type { AgentAdapter } from "../adapters/agentAdapter.js";

void MAX_RETRIES; // imported per spec; shouldRetry enforces the limit internally

export async function executeTask(
  taskDef: TaskDefinition,
  adapter: AgentAdapter,
): Promise<{ taskId: TaskId; finalState: WorkflowState; eventCount: number }> {
  const taskId = taskRegistry.add(taskDef);

  let state = transition(taskId, "task_registered", "NEW");
  taskRegistry.updateState(taskId, state);

  const authResult = authorize({ action: "run_agent", target: taskId, taskId });
  if (!authResult.allowed) {
    throw new Error(`Policy denied action run_agent for task ${taskId}: ${authResult.reason}`);
  }

  state = transition(taskId, "source_locked_agent_started", "SOURCE_LOCK");
  taskRegistry.updateState(taskId, state);

  const prompt = compile(taskId, taskDef.description);
  let result = await adapter.run(prompt);

  if (result.success) {
    state = transition(taskId, "agent_returned_success", "RUNNING_FAKE_AGENT");
    taskRegistry.updateState(taskId, state);
  } else {
    let classification = classify(result);

    if (classification === "transient") {
      state = transition(taskId, "agent_returned_retryable", "RUNNING_FAKE_AGENT");
      taskRegistry.updateState(taskId, state);

      let retryCount = taskRegistry.load(taskId)!.retryCount;
      let done = false;

      while (shouldRetry(classification, retryCount)) {
        state = transition(taskId, "retry_approved", "WAITING_RETRY");
        taskRegistry.updateState(taskId, state);
        retryCount = taskRegistry.incrementRetry(taskId);
        const newPrompt = continuePrompt(taskId, classification, result.output ?? "") ?? prompt;
        result = await adapter.run(newPrompt);

        if (result.success) {
          state = transition(taskId, "agent_returned_success", "RUNNING_FAKE_AGENT");
          taskRegistry.updateState(taskId, state);
          done = true;
          break;
        }

        classification = classify(result);
        if (classification === "transient") {
          state = transition(taskId, "agent_returned_retryable", "RUNNING_FAKE_AGENT");
          taskRegistry.updateState(taskId, state);
        } else {
          state = transition(taskId, "agent_returned_needs_human", "RUNNING_FAKE_AGENT");
          taskRegistry.updateState(taskId, state);
          done = true;
          break;
        }
      }

      if (!done) {
        state = transition(taskId, "retry_limit_exceeded", "WAITING_RETRY");
        taskRegistry.updateState(taskId, state);
      }
    } else {
      // needs_human or permanent (hard)
      state = transition(taskId, "agent_returned_needs_human", "RUNNING_FAKE_AGENT");
      taskRegistry.updateState(taskId, state);
    }
  }

  const finalState = deriveState(taskId);
  taskRegistry.updateState(taskId, finalState);
  metrics.writeMetrics(taskId);

  return { taskId, finalState, eventCount: eventLog.count(taskId) };
}

export function approveTask(taskId: TaskId): WorkflowState {
  const record = taskRegistry.load(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);
  if (record.state !== "NEEDS_HUMAN") {
    throw new Error(`approveTask requires state NEEDS_HUMAN, got: ${record.state}`);
  }
  const nextState = transition(taskId, "human_approved_continue", "NEEDS_HUMAN");
  taskRegistry.updateState(taskId, nextState);
  return nextState;
}

export function retryTask(taskId: TaskId): WorkflowState {
  const record = taskRegistry.load(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);
  if (record.state !== "WAITING_RETRY") {
    throw new Error(`retryTask requires state WAITING_RETRY, got: ${record.state}`);
  }
  const nextState = transition(taskId, "retry_approved", "WAITING_RETRY");
  taskRegistry.updateState(taskId, nextState);
  return nextState;
}

export function getStatus(taskId: TaskId): StatusReport {
  const record = taskRegistry.load(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);
  return {
    taskId: record.taskId,
    state: record.state,
    retryCount: record.retryCount,
    eventCount: eventLog.count(taskId),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
