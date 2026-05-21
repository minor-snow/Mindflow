// EventLog: append-only, no mutations allowed (RB-001)
// All events are stored in-memory for now; file persistence in next iteration.

import type { TaskId, EventEntry } from "../types/index.js";

const store = new Map<TaskId, EventEntry[]>();

/**
 * Append an event entry. This is the ONLY write operation.
 * Existing entries are NEVER modified or deleted (append-only invariant).
 */
export function append(entry: EventEntry): void {
  const existing = store.get(entry.taskId);
  if (existing) {
    existing.push(entry);
  } else {
    store.set(entry.taskId, [entry]);
  }
}

/**
 * Read all events for a task in append order.
 * Returns a frozen copy — callers cannot mutate the log.
 */
export function readAppendOrder(taskId: TaskId): readonly EventEntry[] {
  const entries = store.get(taskId);
  if (!entries) return [];
  return Object.freeze([...entries]);
}

/**
 * Get total event count for a task.
 */
export function count(taskId: TaskId): number {
  return store.get(taskId)?.length ?? 0;
}

/**
 * Reset store (for testing only — not exposed in production API).
 * @internal
 */
export function _resetForTesting(): void {
  store.clear();
}
