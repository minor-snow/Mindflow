import type { TaskId, CompiledPrompt } from "../types/harness-types.js";

// Boundary probe only. Real PromptCompiler is slice-002.
export function compile(
  taskId: TaskId,
  description: string,
  context?: Record<string, unknown>,
): CompiledPrompt {
  return { taskId, content: description, context: context ?? {} };
}
