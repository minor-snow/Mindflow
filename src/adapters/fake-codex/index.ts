import type { AgentResult, CompiledPrompt } from "../../types/index.js";

export async function run(prompt: CompiledPrompt): Promise<AgentResult> {
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (prompt.content.includes("error")) {
    return { success: false, output: "", error: "Codex transient error", retryable: true };
  }

  return { success: true, output: "Fake Codex completed: " + prompt.content.slice(0, 50) };
}
