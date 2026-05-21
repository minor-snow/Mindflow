#!/usr/bin/env node

import { executeTask, approveTask, retryTask, getStatus } from "../harness-core/harnessCore.js";
import * as taskRegistry from "../task-registry/taskRegistry.js";
import * as eventLog from "../event-log/eventLog.js";
import * as metrics from "../observation/metricsCollector.js";
import { fakeClaudeAdapter } from "../adapters/fakeClaudeAdapter.js";
import type { WorkflowState } from "../types/harness-types.js";

const args = process.argv.slice(2);

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

function printUsage(): void {
  console.log(`mfh — Mindflow Harness CLI

Commands:
  task add --desc "..." --scope "..."   Add a new task
  task list [--state STATE]             List tasks
  task status <taskId>                  Show status (JSON)
  task events <taskId>                  Show events (raw JSONL)
  task run-next <taskId>                Run task with fakeClaudeAdapter
  task approve <taskId>                 Approve task (from NEEDS_HUMAN)
  task retry <taskId>                   Retry task (from WAITING_RETRY)
  task metrics <taskId>                 Show metrics (JSON)
  help                                  Show this help`);
}

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = args;

  if (!command || command === "help") {
    printUsage();
    return;
  }

  if (command !== "task") {
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
  }

  switch (subcommand) {
    case "add": {
      const desc = getArg(rest, "--desc");
      const scope = getArg(rest, "--scope");
      if (!desc || !scope) {
        console.error('Usage: task add --desc "..." --scope "..."');
        process.exit(1);
      }
      const taskId = taskRegistry.add({
        description: desc,
        scope,
        createdAt: new Date().toISOString(),
      });
      console.log(taskId);
      break;
    }

    case "list": {
      const state = getArg(rest, "--state");
      const records = state
        ? taskRegistry.list({ state: state as WorkflowState })
        : taskRegistry.list();

      if (records.length === 0) {
        console.log("No tasks found.");
        break;
      }

      const col = (s: string, w: number) => s.padEnd(w);
      console.log(col("TASK_ID", 38) + col("STATE", 22) + col("RETRIES", 9) + "CREATED_AT");
      console.log("-".repeat(100));
      for (const r of records) {
        console.log(
          col(r.taskId, 38) +
          col(r.state, 22) +
          col(String(r.retryCount), 9) +
          r.createdAt,
        );
      }
      break;
    }

    case "status": {
      const taskId = rest[0];
      if (!taskId) {
        console.error("Usage: task status <taskId>");
        process.exit(1);
      }
      const status = getStatus(taskId);
      console.log(JSON.stringify(status, null, 2));
      break;
    }

    case "events": {
      const taskId = rest[0];
      if (!taskId) {
        console.error("Usage: task events <taskId>");
        process.exit(1);
      }
      const events = eventLog.readAppendOrder(taskId);
      for (const e of events) {
        console.log(JSON.stringify(e));
      }
      break;
    }

    case "run-next": {
      const taskId = rest[0];
      if (!taskId) {
        console.error("Usage: task run-next <taskId>");
        process.exit(1);
      }
      const record = taskRegistry.load(taskId);
      if (!record) {
        console.error(`Task not found: ${taskId}`);
        process.exit(1);
      }
      const result = await executeTask(
        {
          id: taskId,
          description: record.definition.description,
          scope: record.definition.scope,
          createdAt: record.definition.createdAt,
        },
        fakeClaudeAdapter,
      );
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case "approve": {
      const taskId = rest[0];
      if (!taskId) {
        console.error("Usage: task approve <taskId>");
        process.exit(1);
      }
      approveTask(taskId);
      const status = getStatus(taskId);
      console.log(status.state);
      break;
    }

    case "retry": {
      const taskId = rest[0];
      if (!taskId) {
        console.error("Usage: task retry <taskId>");
        process.exit(1);
      }
      retryTask(taskId);
      const status = getStatus(taskId);
      console.log(status.state);
      break;
    }

    case "metrics": {
      const taskId = rest[0];
      if (!taskId) {
        console.error("Usage: task metrics <taskId>");
        process.exit(1);
      }
      const report = metrics.getMetrics(taskId);
      console.log(JSON.stringify(report, null, 2));
      break;
    }

    default: {
      console.error(`Unknown subcommand: ${subcommand}`);
      printUsage();
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
