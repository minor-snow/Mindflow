import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { TaskId, TaskDefinition, TaskRecord, WorkflowState } from "../types/harness-types.js";

const DATA_DIR = process.env.MFH_DATA_DIR || join(process.cwd(), "tasks");

function getStatePath(taskId: TaskId): string {
  return join(DATA_DIR, taskId, "state.json");
}

export function add(def: Omit<TaskDefinition, "id"> & { id?: TaskId }): TaskId {
  const taskId: TaskId = def.id ?? randomUUID();
  const now = new Date().toISOString();

  const definition: TaskDefinition = {
    id: taskId,
    description: def.description,
    scope: def.scope,
    createdAt: def.createdAt ?? now,
  };

  const record: TaskRecord = {
    taskId,
    definition,
    state: "NEW",
    retryCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const dir = join(DATA_DIR, taskId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(getStatePath(taskId), JSON.stringify(record, null, 2), "utf-8");
  return taskId;
}

export function load(taskId: TaskId): TaskRecord | null {
  const filePath = getStatePath(taskId);
  if (!existsSync(filePath)) {
    return null;
  }
  return JSON.parse(readFileSync(filePath, "utf-8")) as TaskRecord;
}

export function save(taskId: TaskId, record: TaskRecord): void {
  const filePath = getStatePath(taskId);
  const dir = join(DATA_DIR, taskId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  // Atomic write via temp file pattern is not available in pure Node sync API,
  // so write directly — sufficient for single-process CLI use.
  writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
}

export function updateState(taskId: TaskId, state: WorkflowState): void {
  const record = load(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);
  record.state = state;
  record.updatedAt = new Date().toISOString();
  save(taskId, record);
}

export function incrementRetry(taskId: TaskId): number {
  const record = load(taskId);
  if (!record) throw new Error(`Task not found: ${taskId}`);
  record.retryCount += 1;
  record.updatedAt = new Date().toISOString();
  save(taskId, record);
  return record.retryCount;
}

export function list(filter?: Partial<Pick<TaskRecord, "state">>): readonly TaskRecord[] {
  if (!existsSync(DATA_DIR)) {
    return [];
  }

  const entries = readdirSync(DATA_DIR, { withFileTypes: true });
  const records: TaskRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const record = load(entry.name);
    if (!record) continue;
    if (filter?.state && record.state !== filter.state) continue;
    records.push(record);
  }

  return records;
}
