import { executeTask, getStatus } from "../harness-core/harnessCore.js";
import type { TaskDefinition } from "../types/harness-types.js";
import * as fakeClaudeAdapter from "../adapters/fake-claude/fakeClaudeAdapter.js";

export type ExitCode = 0 | 1;

const args = process.argv.slice(2);

async function main(): Promise<ExitCode> {
  const command = args[0];

  if (command === "run" && args[1] !== undefined) {
    const task: TaskDefinition = {
      id: Date.now().toString(),
      description: args[1],
      scope: "cli",
      createdAt: new Date().toISOString(),
    };
    const result = await executeTask(task, fakeClaudeAdapter.run);
    console.log(JSON.stringify(result, null, 2));
    return result.finalState === "DONE" || result.finalState === "READY_FOR_NEXT_SLICE" ? 0 : 1;
  }

  if (command === "status") {
    const taskId = args[1];
    if (taskId === undefined) {
      console.log("Usage: mfh status <taskId>");
      return 1;
    }
    const report = getStatus(taskId);
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }

  console.log("Usage:");
  console.log("  mfh run <description>");
  console.log("  mfh status <taskId>");
  return 1;
}

main().then((exitCode) => {
  process.exitCode = exitCode;
});
