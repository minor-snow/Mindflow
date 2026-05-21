import { ProposedAction, PolicyDecision } from "../types/index.js";

const DANGEROUS_ACTIONS = new Set([
  "delete_task",
  "force_override_state",
  "skip_policy_gate",
]);

const FORBIDDEN_MUTATIONS = new Set([
  "modify_event_log",
  "rewrite_event",
  "delete_event",
]);

export function authorize(action: ProposedAction): PolicyDecision {
  if (DANGEROUS_ACTIONS.has(action.type)) {
    return { allowed: false, reason: "Dangerous action requires human approval (RB-003)" };
  }
  if (FORBIDDEN_MUTATIONS.has(action.type)) {
    return { allowed: false, reason: "Event log mutation forbidden (RB-001/RB-002)" };
  }
  return { allowed: true, reason: "Action permitted" };
}

export function requiresHumanApproval(action: ProposedAction): boolean {
  return DANGEROUS_ACTIONS.has(action.type);
}
