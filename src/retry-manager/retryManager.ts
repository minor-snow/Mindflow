import type { TaskId, AgentResult, RetryClassification, CompiledPrompt } from "../types/harness-types.js";

export const MAX_RETRIES = 3;

export function classify(result: AgentResult): RetryClassification {
  if (result.success) {
    throw new Error("classify called on successful result");
  }
  if (result.retryable) {
    return "transient";
  }
  const errorMsg = (result.error ?? "").toLowerCase();
  if (errorMsg.includes("human") || errorMsg.includes("approval")) {
    return "needs_human";
  }
  return "hard";
}

export function shouldRetry(classification: RetryClassification, retryCount: number): boolean {
  return classification === "transient" && retryCount < MAX_RETRIES;
}

export function continuePrompt(
  taskId: TaskId,
  classification: RetryClassification,
  previousOutput: string,
): CompiledPrompt | null {
  if (classification !== "transient") {
    return null;
  }
  return {
    taskId,
    content: `Retry task ${taskId}. Previous attempt output: ${previousOutput}`,
    context: {
      classification,
      previousOutput,
      retryReason: "transient_error",
    },
  };
}
