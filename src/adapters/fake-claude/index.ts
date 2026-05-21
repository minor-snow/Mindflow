import type { AgentResult, CompiledPrompt } from "../../types/index.js";

export async function run(prompt: CompiledPrompt): Promise<AgentResult> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (prompt.content.includes("fail")) {
    return { success: false, output: "", error: "Simulated failure", retryable: true };
  }

  if (prompt.content.includes("block")) {
    return { success: false, output: "", error: "Needs human approval", retryable: false };
  }

  return { success: true, output: "Fake Claude completed: " + prompt.content.slice(0, 50) };
}
