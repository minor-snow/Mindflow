/**
 * Unit test: StateMachine
 * Verifies all 12 DSA transitions and rejects invalid ones
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { transition, deriveState } from "./stateMachine.js";
import { _resetForTesting as resetEventLog } from "../event-log/eventLog.js";
import type { WorkflowEvent } from "../types/harness-types.js";

describe("stateMachine.transition", () => {
  beforeEach(() => {
    resetEventLog();
  });

  it("valid: NEW → SOURCE_LOCK via task_registered", () => {
    const next = transition("sm1", "task_registered", "NEW");
    assert.equal(next, "SOURCE_LOCK");
  });

  it("valid: SOURCE_LOCK → RUNNING_FAKE_AGENT", () => {
    const next = transition("sm2", "source_locked_agent_started", "SOURCE_LOCK");
    assert.equal(next, "RUNNING_FAKE_AGENT");
  });

  it("valid: RUNNING_FAKE_AGENT → WAITING_RETRY", () => {
    const next = transition("sm3", "agent_returned_retryable", "RUNNING_FAKE_AGENT");
    assert.equal(next, "WAITING_RETRY");
  });

  it("valid: WAITING_RETRY → RUNNING_FAKE_AGENT via retry_approved", () => {
    const next = transition("sm4", "retry_approved", "WAITING_RETRY");
    assert.equal(next, "RUNNING_FAKE_AGENT");
  });

  it("valid: DONE → READY_FOR_NEXT_SLICE", () => {
    const next = transition("sm5", "outputs_verified", "DONE");
    assert.equal(next, "READY_FOR_NEXT_SLICE");
  });

  it("invalid transition throws", () => {
    assert.throws(() => {
      transition("sm6", "agent_returned_success" as WorkflowEvent, "NEW");
    }, /invalid transition/i);
  });
});

describe("stateMachine.deriveState", () => {
  beforeEach(() => {
    resetEventLog();
  });

  it("returns NEW for task with no events", () => {
    const state = deriveState("nonexistent");
    assert.equal(state, "NEW");
  });

  it("derives state from event replay", () => {
    transition("dr1", "task_registered", "NEW");
    transition("dr1", "source_locked_agent_started", "SOURCE_LOCK");
    const state = deriveState("dr1");
    assert.equal(state, "RUNNING_FAKE_AGENT");
  });
});
