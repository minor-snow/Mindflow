import type { CompiledPrompt, AgentResult } from "../types/harness-types.js";

export interface AgentAdapter {
  readonly name: string;
  run(prompt: CompiledPrompt): Promise<AgentResult>;
}
