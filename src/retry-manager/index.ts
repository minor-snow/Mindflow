export type RetryClassification = "transient" | "permanent" | "needs_human";

export type AgentResult = {
  success: boolean;
  output: string;
  error?: string;
  retryable?: boolean;
};

export function classify(result: AgentResult): RetryClassification {
  if (result.success) {
    throw new Error("classify should not be called on a successful result");
  }
  if (result.retryable) {
    return "transient";
  }
  if (result.error && /human|approval/i.test(result.error)) {
    return "needs_human";
  }
  return "permanent";
}

export function shouldRetry(classification: RetryClassification): boolean {
  return classification === "transient";
}
