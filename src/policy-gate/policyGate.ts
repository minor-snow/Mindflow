import type { PolicyRule, ProposedAction, PolicyDecision } from "../types/harness-types.js";

export interface AuthResult {
  allowed: boolean;
  reason: string;
  ruleId: string;
  requiresHuman: boolean;
}

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

function matchRule(action: ProposedAction, rules: readonly PolicyRule[]): PolicyRule {
  for (const rule of rules) {
    if (rule.action_pattern === "*" || rule.action_pattern === action.action) {
      return rule;
    }
  }
  throw new Error(`No matching rule for action: ${String(action.action)}`);
}

export function authorize(action: ProposedAction, rules?: readonly PolicyRule[]): AuthResult {
  const effectiveRules = rules ?? DEFAULT_RULES;
  const rule = matchRule(action, effectiveRules);
  const decision: PolicyDecision = rule.decision;
  return {
    allowed: decision === "allow",
    reason: rule.reason,
    ruleId: rule.id,
    requiresHuman: decision === "requires_human",
  };
}

export function requiresHumanApproval(action: ProposedAction): boolean {
  return authorize(action).requiresHuman;
}

export function getRules(): readonly PolicyRule[] {
  return DEFAULT_RULES;
}
