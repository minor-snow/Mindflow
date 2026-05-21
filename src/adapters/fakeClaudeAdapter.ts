import type { AgentAdapter } from "./agentAdapter.js";
import type { CompiledPrompt, AgentResult } from "../types/harness-types.js";

type ScenarioKey = "ok" | "transient_error" | "hard_error" | "needs_human" | "task_failed";

const SCENARIOS: Record<ScenarioKey, AgentResult> = {
  ok: { success: true, output: "Task completed successfully." },
  transient_error: { success: false, error: "Transient failure, please retry.", retryable: true },
  hard_error: { success: false, error: "Permanent failure, cannot recover.", retryable: false },
  needs_human: { success: false, error: "Human intervention required.", retryable: false },
  task_failed: { success: false, error: "Task failed permanently.", retryable: false },
};

const SCENARIO_KEYS: ScenarioKey[] = ["ok", "transient_error", "hard_error", "needs_human", "task_failed"];

function selectScenario(prompt: CompiledPrompt): ScenarioKey {
  for (const key of SCENARIO_KEYS) {
    if (prompt.content.includes(key)) return key;
  }
  return "ok";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const fakeClaudeAdapter: AgentAdapter = {
  name: "fake-claude",
  async run(prompt: CompiledPrompt): Promise<AgentResult> {
    await delay(50);
    return SCENARIOS[selectScenario(prompt)];
  },
};
