import { randomUUID } from "node:crypto";
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { TaskId, WorkflowEvent, EventEntry } from "../types/harness-types.js";

const DATA_DIR = process.env.MFH_DATA_DIR || join(process.cwd(), "tasks");

export function getEventsPath(taskId: TaskId): string {
  return join(DATA_DIR, taskId, "events.jsonl");
}

export function append(
  taskId: TaskId,
  event: WorkflowEvent,
  actor: string,
  data: Record<string, unknown> = {}
): EventEntry {
  const entry: EventEntry = {
    eventId: randomUUID(),
    taskId,
    timestamp: new Date().toISOString(),
    event,
    actor,
    data,
  };

  const filePath = getEventsPath(taskId);
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf-8");
  return entry;
}

export function readAppendOrder(taskId: TaskId): readonly EventEntry[] {
  const filePath = getEventsPath(taskId);
  if (!existsSync(filePath)) {
    return [];
  }

  const raw = readFileSync(filePath, "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as EventEntry);
}

export function count(taskId: TaskId): number {
  return readAppendOrder(taskId).length;
}
