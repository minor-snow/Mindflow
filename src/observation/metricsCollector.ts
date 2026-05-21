import type { MetricsReport, TaskId } from "../types/harness-types.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

interface Counters {
  invalid_transition_count: number;
  policy_bypass_attempt_count: number;
  event_log_rewrite_count: number;
  transient_error_misroute_count: number;
}

const store = new Map<TaskId, Counters>();

function getOrCreate(taskId: TaskId): Counters {
  if (!store.has(taskId)) {
    store.set(taskId, {
      invalid_transition_count: 0,
      policy_bypass_attempt_count: 0,
      event_log_rewrite_count: 0,
      transient_error_misroute_count: 0,
    });
  }
  return store.get(taskId)!;
}

export function recordInvalidTransition(taskId: TaskId): void {
  getOrCreate(taskId).invalid_transition_count++;
}

export function recordPolicyBypassAttempt(taskId: TaskId): void {
  getOrCreate(taskId).policy_bypass_attempt_count++;
}

export function recordEventRewriteAttempt(taskId: TaskId): void {
  getOrCreate(taskId).event_log_rewrite_count++;
}

export function recordTransientMisroute(taskId: TaskId): void {
  getOrCreate(taskId).transient_error_misroute_count++;
}

export function getMetrics(taskId: TaskId): MetricsReport {
  const c = getOrCreate(taskId);
  return {
    taskId,
    evaluatedAt: new Date().toISOString(),
    invalid_transition_count: c.invalid_transition_count,
    policy_bypass_attempt_count: c.policy_bypass_attempt_count,
    event_log_rewrite_count: c.event_log_rewrite_count,
    transient_error_misroute_count: c.transient_error_misroute_count,
    forbidden_dependency_count: 0,
    expected_output_completion_ratio: 1.0,
  };
}

export function writeMetrics(taskId: TaskId): void {
  const report = getMetrics(taskId);
  const dir = join("tasks", taskId, "reports");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "metrics.json"), JSON.stringify(report, null, 2));
}

export function resetMetrics(taskId: TaskId): void {
  store.delete(taskId);
}
