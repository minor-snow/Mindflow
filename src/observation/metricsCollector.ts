import type { MetricsReport, TaskId } from "../types/harness-types.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = process.env.MFH_DATA_DIR || join(process.cwd(), "tasks");
const counters = new Map<TaskId, { invalid: number; bypass: number; rewrite: number; misroute: number }>();

function ensure(taskId: TaskId) {
  if (!counters.has(taskId)) counters.set(taskId, { invalid: 0, bypass: 0, rewrite: 0, misroute: 0 });
  return counters.get(taskId)!;
}

export function recordInvalidTransition(taskId: TaskId): void { ensure(taskId).invalid++; }
export function recordPolicyBypassAttempt(taskId: TaskId): void { ensure(taskId).bypass++; }
export function recordEventRewriteAttempt(taskId: TaskId): void { ensure(taskId).rewrite++; }
export function recordTransientMisroute(taskId: TaskId): void { ensure(taskId).misroute++; }

export function getMetrics(taskId: TaskId): MetricsReport {
  const c = ensure(taskId);
  return {
    taskId,
    evaluatedAt: new Date().toISOString(),
    invalid_transition_count: c.invalid,
    policy_bypass_attempt_count: c.bypass,
    event_log_rewrite_count: c.rewrite,
    transient_error_misroute_count: c.misroute,
    forbidden_dependency_count: 0,
    expected_output_completion_ratio: 1.0,
  };
}

export function writeMetrics(taskId: TaskId): void {
  const dir = join(DATA_DIR, taskId, "reports");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "metrics.json"), JSON.stringify(getMetrics(taskId), null, 2) + "\n");
}

export function resetMetrics(taskId: TaskId): void { counters.delete(taskId); }
