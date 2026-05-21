# slice-001 Implementation Contract

## Scope Definition

**slice-001 = 可执行治理内核**：文件持久化、append-only event log、严格状态机、policy gate 规则引擎、retry manager、fake adapters、真实 CLI、可机械评测 metrics。

**不包含**：real Claude/Codex API、real PromptCompiler intelligence、Docker gate、browser gate、validation runner、packaging、batch scheduler、K Kernel briefing injection（预留接口，null provider）。

---

## 1. File Tree

```
/home/centi/Mindflow/
├── package.json
├── tsconfig.json
├── .gitignore
├── src/
│   ├── types/
│   │   └── harness-types.ts
│   ├── event-log/
│   │   └── eventLog.ts              # append-only JSONL file I/O
│   ├── task-registry/
│   │   └── taskRegistry.ts          # tasks/{taskId}/state.json
│   ├── state-machine/
│   │   └── stateMachine.ts          # strict transition table
│   ├── policy-gate/
│   │   └── policyGate.ts            # rule engine (PolicyRule[])
│   ├── retry-manager/
│   │   └── retryManager.ts          # classify + shouldRetry + continuePrompt
│   ├── prompt-compiler/
│   │   └── promptCompilerStub.ts    # boundary probe only
│   ├── adapters/
│   │   ├── agentAdapter.ts          # protocol interface
│   │   ├── fakeClaudeAdapter.ts     # deterministic scenarios
│   │   └── fakeCodexAdapter.ts      # deterministic scenarios
│   ├── observation/
│   │   └── metricsCollector.ts      # count violations, output JSON
│   ├── harness-core/
│   │   └── harnessCore.ts           # orchestrator
│   └── cli/
│       └── mfh.ts                   # full CLI
├── tasks/                            # runtime data (gitignored)
│   └── {taskId}/
│       ├── state.json
│       ├── events.jsonl
│       └── reports/
│           └── metrics.json
└── test/
    ├── eventLog.test.ts
    ├── taskRegistry.test.ts
    ├── stateMachine.test.ts
    ├── policyGate.test.ts
    ├── retryManager.test.ts
    ├── fakeAdapters.test.ts
    └── cli.test.ts
```

---

## 2. Schemas

### TaskState (tasks/{taskId}/state.json)
```json
{
  "taskId": "string",
  "definition": { "id": "string", "description": "string", "scope": "string", "createdAt": "ISO8601" },
  "state": "WorkflowState",
  "retryCount": 0,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### EventEntry (tasks/{taskId}/events.jsonl — one per line)
```json
{"eventId": "uuid", "taskId": "string", "timestamp": "ISO8601", "event": "WorkflowEvent", "actor": "string", "data": {}}
```

### PolicyRule
```json
{
  "id": "string",
  "action_pattern": "string",
  "decision": "allow | requires_human | block",
  "severity": "hard | soft",
  "reason": "string"
}
```

### MetricsReport (tasks/{taskId}/reports/metrics.json)
```json
{
  "taskId": "string",
  "evaluatedAt": "ISO8601",
  "invalid_transition_count": 0,
  "policy_bypass_attempt_count": 0,
  "event_log_rewrite_count": 0,
  "transient_error_misroute_count": 0,
  "forbidden_dependency_count": 0,
  "expected_output_completion_ratio": 1.0
}
```

---

## 3. Interfaces

```typescript
// AgentAdapter protocol
interface AgentAdapter {
  readonly name: string;
  run(prompt: CompiledPrompt): Promise<AgentResult>;
}

// PromptCompiler stub (boundary probe)
interface PromptCompiler {
  compile(taskId: TaskId, context: PromptContext): CompiledPrompt;
}

// BriefingProvider (null provider for slice-001)
interface BriefingProvider {
  getBriefing(taskId: TaskId): Briefing | null;
}

// ObservationCollector
interface ObservationCollector {
  recordInvalidTransition(taskId: TaskId, from: WorkflowState, event: WorkflowEvent): void;
  recordPolicyBypassAttempt(taskId: TaskId, action: ProposedAction): void;
  recordEventRewriteAttempt(taskId: TaskId): void;
  recordTransientMisroute(taskId: TaskId): void;
  getMetrics(taskId: TaskId): MetricsReport;
}
```

---

## 4. CLI Commands

| Command | Description |
|---------|-------------|
| `mfh task add --desc "..." --scope "..."` | Register new task, state=NEW |
| `mfh task list [--state STATE]` | List tasks, optional filter |
| `mfh task status <taskId>` | Show task state + event count |
| `mfh task events <taskId>` | Print events.jsonl for task |
| `mfh task run-next <taskId>` | Execute next step (transition + adapter) |
| `mfh task approve <taskId>` | Human approval → resume from NEEDS_HUMAN |
| `mfh task retry <taskId>` | Manual retry → resume from WAITING_RETRY |
| `mfh task metrics <taskId>` | Output metrics.json |

---

## 5. State Transitions

```
NEW → SOURCE_LOCK                    [task_registered]
SOURCE_LOCK → RUNNING_FAKE_AGENT     [source_locked_agent_started]
RUNNING_FAKE_AGENT → WAITING_RETRY   [agent_returned_retryable]
RUNNING_FAKE_AGENT → NEEDS_HUMAN     [agent_returned_needs_human]
RUNNING_FAKE_AGENT → DONE            [agent_returned_success]
RUNNING_FAKE_AGENT → BLOCKED         [policy_gate_blocked]
WAITING_RETRY → RUNNING_FAKE_AGENT   [retry_approved]
WAITING_RETRY → NEEDS_HUMAN          [retry_limit_exceeded]
NEEDS_HUMAN → RUNNING_FAKE_AGENT     [human_approved_continue]
NEEDS_HUMAN → BLOCKED                [human_rejected]
BLOCKED → NEEDS_HUMAN                [unblock_requested]
DONE → READY_FOR_NEXT_SLICE          [outputs_verified]
```

Invalid transitions throw and increment `invalid_transition_count`.

---

## 6. Policy Rules (default set)

```typescript
const DEFAULT_RULES: PolicyRule[] = [
  { id: "PG-001", action_pattern: "delete_task", decision: "requires_human", severity: "hard", reason: "Task deletion requires human approval" },
  { id: "PG-002", action_pattern: "force_override_state", decision: "block", severity: "hard", reason: "State override forbidden" },
  { id: "PG-003", action_pattern: "skip_policy_gate", decision: "block", severity: "hard", reason: "Cannot bypass policy gate" },
  { id: "PG-004", action_pattern: "modify_event_log", decision: "block", severity: "hard", reason: "Event log is append-only (RB-001)" },
  { id: "PG-005", action_pattern: "rewrite_event", decision: "block", severity: "hard", reason: "Event rewrite forbidden (RB-002)" },
  { id: "PG-006", action_pattern: "delete_event", decision: "block", severity: "hard", reason: "Event deletion forbidden (RB-001)" },
  { id: "PG-007", action_pattern: "git_push", decision: "requires_human", severity: "hard", reason: "Release operation requires approval" },
  { id: "PG-008", action_pattern: "modify_docs_original", decision: "requires_human", severity: "hard", reason: "Original docs require approval (RB-007)" },
  { id: "PG-009", action_pattern: "run_agent", decision: "allow", severity: "soft", reason: "Agent execution permitted" },
  { id: "PG-010", action_pattern: "*", decision: "allow", severity: "soft", reason: "Default allow for unmatched actions" },
];
```

Match logic: first rule where `action_pattern` matches (glob or exact) wins. Hard block > requires_human > allow.

---

## 7. Fake Adapter Scenarios

```typescript
// FakeClaudeAdapter scenarios (deterministic by prompt content)
const SCENARIOS = {
  "ok":              { success: true, output: "Task completed successfully" },
  "transient_error": { success: false, error: "Connection timeout", retryable: true },
  "hard_error":      { success: false, error: "Fatal: invalid input format", retryable: false },
  "needs_human":     { success: false, error: "Requires human approval to proceed" },
  "task_failed":     { success: false, error: "Task implementation failed permanently" },
};

// Scenario selection: if prompt.content contains scenario key, use it. Default: "ok".
```

FakeCodexAdapter: same protocol, different output prefix ("Codex: ...").

---

## 8. Tests

| Test file | Validates |
|-----------|-----------|
| `eventLog.test.ts` | append-only JSONL, read order, no mutation, file persistence |
| `taskRegistry.test.ts` | file save/load, directory bootstrap, atomic write |
| `stateMachine.test.ts` | all 12 valid transitions, invalid throws, deriveState replay |
| `policyGate.test.ts` | rule matching, priority (block > requires_human > allow), RB-001/002/003 |
| `retryManager.test.ts` | classify, shouldRetry with count, continuePrompt boundary |
| `fakeAdapters.test.ts` | all 5 scenarios, protocol conformance |
| `cli.test.ts` | add/list/status/events/run-next/approve/retry commands |

---

## 9. Out of Scope (explicitly excluded)

1. Real Claude Code CLI execution
2. Real Codex CLI execution
3. Real PromptCompiler intelligence (only stub/spy)
4. Official Codex report generation
5. Docker test gate
6. Browser smoke gate
7. original_sessions export
8. Validation runner
9. Packaging zip
10. Batch scheduler
11. K Kernel briefing injection (null provider only)
12. Multi-agent coordination
13. Real API keys / network calls

---

## 10. Acceptance Commands

```bash
# All must pass for slice-001 to be considered complete:
cd /home/centi/Mindflow

# 1. TypeScript compiles
npx tsc --noEmit

# 2. All tests pass
node --test dist/**/*.test.js

# 3. CLI smoke test
mfh task add --desc "acceptance test" --scope "test"
mfh task list
mfh task run-next <taskId>
mfh task status <taskId>
mfh task events <taskId>
mfh task metrics <taskId>

# 4. File persistence verified
ls tasks/*/state.json
cat tasks/*/events.jsonl | wc -l

# 5. Metrics all zero (no violations in happy path)
cat tasks/*/reports/metrics.json | jq '.invalid_transition_count, .policy_bypass_attempt_count, .event_log_rewrite_count'
```
