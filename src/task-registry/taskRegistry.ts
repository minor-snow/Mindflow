// TaskRegistry: CRUD for task records
// Stores tasks in-memory; file persistence (tasks/{taskId}/state.json) in next iteration.

import type { TaskId, TaskDefinition, TaskRecord, WorkflowState } from "../types/harness-types.js";

const registry = new Map<TaskId, TaskRecord>();

/**
 * Register a new task. Returns the TaskId.
 */
export function add(task: TaskDefinition): TaskId {
  if (registry.has(task.id)) {
    throw new Error(`Task ${task.id} already exists`);
  }
  const now = new Date().toISOString();
  const record: TaskRecord = {
    definition: task,
    state: "NEW",
    createdAt: now,
    updatedAt: now,
  };
  registry.set(task.id, record);
  return task.id;
}

/**
 * Load a task record by ID. Returns null if not found.
 */
export function load(taskId: TaskId): TaskRecord | null {
  return registry.get(taskId) ?? null;
}

/**
 * Save/update a task record.
 */
export function save(taskId: TaskId, record: TaskRecord): void {
  registry.set(taskId, record);
}

/**
 * Update just the workflow state of a task.
 */
export function updateState(taskId: TaskId, state: WorkflowState): void {
  const existing = registry.get(taskId);
  if (!existing) throw new Error(`Task ${taskId} not found`);
  registry.set(taskId, {
    ...existing,
    state,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * List all tasks, optionally filtered by state.
 */
export function list(filter?: { state?: WorkflowState }): readonly TaskRecord[] {
  const all = [...registry.values()];
  if (filter?.state) {
    return all.filter(r => r.state === filter.state);
  }
  return all;
}

/**
 * Reset registry (for testing only).
 * @internal
 */
export function _resetForTesting(): void {
  registry.clear();
}
