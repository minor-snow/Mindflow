import { executeTask } from './harness-core/harnessCore.js';
import { run } from './adapters/fake-claude/fakeClaudeAdapter.js';

const task = {
  id: 'smoke-1',
  description: 'smoke test',
  scope: 'test',
  createdAt: new Date().toISOString(),
};

const { taskId, finalState, events } = await executeTask(task, run);

console.log(`taskId: ${taskId}`);
console.log(`finalState: ${finalState}`);
console.log(`event count: ${events.length}`);

process.exit(finalState === 'DONE' ? 0 : 1);
