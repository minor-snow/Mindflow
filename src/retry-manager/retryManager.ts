import { TaskId, AgentResult, RetryClassification, CompiledPrompt } from "../types/harness-types.js";

const MAX_RETRIES = 3;

export function classify(result: AgentResult): RetryClassification {
  if (result.success) {
    throw new Error("Cannot classify successful result");
  }
  if (result.retryable === true) {
    return "transient";
  }
  if (/human|approval/i.test(result.error ?? "")) {
    return "needs_human";
  }
  return "permanent";
}

export function shouldRetry(classification: RetryClassification, attemptCount: number): boolean {
  return classification === "transient" && attemptCount < MAX_RETRIES;
}

export function continuePrompt(
  taskId: TaskId,
  classification: RetryClassification,
  previousOutput: string
): CompiledPrompt | null {
  if (classification !== "transient") {
    return null;
  }
  return {
    taskId,
    content: "Continue from where you left off.",
    context: [previousOutput.slice(-500)],
  };
}
