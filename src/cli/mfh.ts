#!/usr/bin/env node

import * as taskRegistry from "../task-registry/taskRegistry.js";
import * as eventLog from "../event-log/eventLog.js";
import * as metricsCollector from "../observation/metricsCollector.js";
import * as harnessCore from "../harness-core/harnessCore.js";
import { fakeClaudeAdapter } from "../adapters/fakeClaudeAdapter.js";
import type { WorkflowState } from "../types/harness-types.js";

const args = process.argv.slice(2);

function parseFlags(tokens: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].startsWith("--") && i + 1 < tokens.length && !tokens[i + 1].startsWith("--")) {
      flags[tokens[i].slice(2)] = tokens[i + 1];
      i++;
    }
  }
  return flags;
}

function printHelp(): void {
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
    printHelp();
    return;
  }

  if (command !== "task") {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  switch (subcommand) {
    case "add": {
      const flags = parseFlags(rest);
      if (!flags.desc || !flags.scope) {
        console.error('Usage: task add --desc "..." --scope "..."');
        process.exit(1);
      }
      const taskId = taskRegistry.add({
        description: flags.desc,
        scope: flags.scope,
        createdAt: new Date().toISOString(),
      });
      console.log(taskId);
      break;
    }

    case "list": {
      const flags = parseFlags(rest);
      const records = flags.state
        ? taskRegistry.list({ state: flags.state as WorkflowState })
        : taskRegistry.list();

      if (records.length === 0) {
        console.log("No tasks found.");
        break;
      }

      const col = (s: string, w: number) => s.padEnd(w);
      console.log(
        col("TASK_ID", 38) + col("STATE", 22) + col("RETRIES", 9) + "CREATED_AT",
      );
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
      const status = harnessCore.getStatus(taskId);
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
      const result = await harnessCore.executeTask(
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
      harnessCore.approveTask(taskId);
      console.log(`Task ${taskId} approved.`);
      break;
    }

    case "retry": {
      const taskId = rest[0];
      if (!taskId) {
        console.error("Usage: task retry <taskId>");
        process.exit(1);
      }
      harnessCore.retryTask(taskId);
      console.log(`Task ${taskId} retry approved.`);
      break;
    }

    case "metrics": {
      const taskId = rest[0];
      if (!taskId) {
        console.error("Usage: task metrics <taskId>");
        process.exit(1);
      }
      const metrics = metricsCollector.getMetrics(taskId);
      console.log(JSON.stringify(metrics, null, 2));
      break;
    }

    default: {
      console.error(`Unknown subcommand: ${subcommand}`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
