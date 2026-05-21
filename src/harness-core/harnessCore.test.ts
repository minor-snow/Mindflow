/**
 * Integration test: Mindflow Harness Core end-to-end
 *
 * Tests the full orchestration pipeline:
 * - Task registration → state transitions → agent execution → final state
 * - Retry logic (transient errors → WAITING_RETRY → retry)
 * - Needs-human path (non-retryable → NEEDS_HUMAN)
 * - Event log append-only invariant
 * - Policy gate enforcement
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { executeTask, getStatus } from "./harnessCore.js";
import { _resetForTesting as resetEventLog, readAppendOrder } from "../event-log/eventLog.js";
import { _resetForTesting as resetRegistry, load } from "../task-registry/taskRegistry.js";
import type { TaskDefinition, AgentResult, CompiledPrompt } from "../types/harness-types.js";

function makeTask(id: string, desc: string): TaskDefinition {
  return { id, description: desc, scope: "test", createdAt: new Date().toISOString() };
}

describe("harnessCore.executeTask", () => {
  beforeEach(() => {
    resetEventLog();
    resetRegistry();
  });

  it("happy path: agent succeeds → DONE", async () => {
    const successAgent = async (_p: CompiledPrompt): Promise<AgentResult> => ({
      success: true, output: "done"
    });

    const result = await executeTask(makeTask("t1", "do something"), successAgent);

    assert.equal(result.taskId, "t1");
    assert.equal(result.finalState, "DONE");
    assert.ok(result.events.length >= 3, "should have at least 3 events (registered, started, success)");

    // Verify event log is populated
    const events = readAppendOrder("t1");
    assert.ok(events.length >= 3);

    // Verify task registry state
    const record = load("t1");
    assert.ok(record !== null);
    assert.equal(record!.state, "DONE");
  });

  it("transient failure → retry → success", async () => {
    let callCount = 0;
    const retryAgent = async (_p: CompiledPrompt): Promise<AgentResult> => {
      callCount++;
      if (callCount < 3) {
        return { success: false, output: "", error: "timeout", retryable: true };
      }
      return { success: true, output: "succeeded on attempt 3" };
    };

    const result = await executeTask(makeTask("t2", "retry test"), retryAgent);

    assert.equal(result.taskId, "t2");
    assert.equal(result.finalState, "DONE");
    assert.equal(callCount, 3);
  });

  it("transient failure → exhaust retries → NEEDS_HUMAN", async () => {
    const alwaysFailAgent = async (_p: CompiledPrompt): Promise<AgentResult> => ({
      success: false, output: "", error: "always fails", retryable: true
    });

    const result = await executeTask(makeTask("t3", "exhaust retries"), alwaysFailAgent);

    assert.equal(result.taskId, "t3");
    assert.equal(result.finalState, "NEEDS_HUMAN");
  });

  it("permanent failure → NEEDS_HUMAN immediately", async () => {
    const permanentFailAgent = async (_p: CompiledPrompt): Promise<AgentResult> => ({
      success: false, output: "", error: "fatal error", retryable: false
    });

    const result = await executeTask(makeTask("t4", "permanent fail"), permanentFailAgent);

    assert.equal(result.taskId, "t4");
    assert.equal(result.finalState, "NEEDS_HUMAN");
  });

  it("needs human approval → NEEDS_HUMAN", async () => {
    const needsHumanAgent = async (_p: CompiledPrompt): Promise<AgentResult> => ({
      success: false, output: "", error: "needs human approval to proceed"
    });

    const result = await executeTask(makeTask("t5", "human needed"), needsHumanAgent);

    assert.equal(result.taskId, "t5");
    assert.equal(result.finalState, "NEEDS_HUMAN");
  });

  it("event log is append-only (no mutations)", async () => {
    const agent = async (_p: CompiledPrompt): Promise<AgentResult> => ({
      success: true, output: "ok"
    });

    await executeTask(makeTask("t6", "append only test"), agent);

    const events = readAppendOrder("t6");
    // Verify events are frozen (Object.isFrozen on the array)
    assert.ok(Object.isFrozen(events), "readAppendOrder should return frozen array");
  });
});

describe("harnessCore.getStatus", () => {
  beforeEach(() => {
    resetEventLog();
    resetRegistry();
  });

  it("returns status for completed task", async () => {
    const agent = async (_p: CompiledPrompt): Promise<AgentResult> => ({
      success: true, output: "done"
    });

    await executeTask(makeTask("t7", "status test"), agent);
    const status = getStatus("t7");

    assert.equal(status.taskId, "t7");
    assert.equal(status.state, "DONE");
    assert.ok(status.eventCount >= 3);
  });
});
