/**
 * Unit test: PolicyGate
 * Verifies DSA risk boundaries RB-001, RB-002, RB-003
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { authorize, requiresHumanApproval } from "./policyGate.js";
import type { ProposedAction } from "../types/harness-types.js";

describe("policyGate.authorize", () => {
  it("blocks dangerous actions (RB-003)", () => {
    const actions: ProposedAction[] = [
      { type: "delete_task", target: "t1", taskId: "t1" },
      { type: "force_override_state", target: "t1", taskId: "t1" },
      { type: "skip_policy_gate", target: "t1", taskId: "t1" },
    ];

    for (const action of actions) {
      const decision = authorize(action);
      assert.equal(decision.allowed, false, `${action.type} should be blocked`);
      assert.ok(decision.reason.includes("human approval"));
    }
  });

  it("blocks event log mutations (RB-001/RB-002)", () => {
    const actions: ProposedAction[] = [
      { type: "modify_event_log", target: "t1", taskId: "t1" },
      { type: "rewrite_event", target: "t1", taskId: "t1" },
      { type: "delete_event", target: "t1", taskId: "t1" },
    ];

    for (const action of actions) {
      const decision = authorize(action);
      assert.equal(decision.allowed, false, `${action.type} should be blocked`);
      assert.ok(decision.reason.includes("forbidden"));
    }
  });

  it("allows normal actions", () => {
    const action: ProposedAction = { type: "run_agent", target: "t1", taskId: "t1" };
    const decision = authorize(action);
    assert.equal(decision.allowed, true);
  });

  it("requiresHumanApproval returns true for dangerous actions", () => {
    assert.equal(requiresHumanApproval({ type: "delete_task", target: "t1", taskId: "t1" }), true);
    assert.equal(requiresHumanApproval({ type: "run_agent", target: "t1", taskId: "t1" }), false);
  });
});
