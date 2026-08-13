import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, test } from "vitest";
import {
  buildProofBundle,
  getIntentRun,
  getLatestDueLockedIntent,
  getLatestIntentRun,
  resetDatabaseForTests,
  saveExecutionStep,
  saveIntent,
  saveSimulationFailure,
  updateIntentUnlockAt,
} from "./store";
import type { ExecutionStatus } from "../keeperhub/types";

const directory = mkdtempSync(join(tmpdir(), "fomo-store-"));
process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;

afterAll(() => {
  resetDatabaseForTests();
  rmSync(directory, { recursive: true, force: true });
});

const intentId = `0x${"1".repeat(64)}`;

function execution(executionId: string, status: ExecutionStatus["status"]): ExecutionStatus {
  return {
    executionId,
    status,
    transactionHash: status === "completed" ? `0x${"2".repeat(64)}` : null,
    transactionLink: status === "completed" ? "https://sepolia.basescan.org/tx/0x2" : null,
    receipts: status === "completed" ? [{
      hash: `0x${"2".repeat(64)}`,
      chainId: 84532,
      verified: true,
      receiptStatus: "success",
    }] : [],
  };
}

test("persists and recovers an idempotent KeeperHub execution", () => {
  saveIntent({
    intentId,
    requestId: "request-123",
    sourceText: "Buy 1 USDC of ETH",
    asset: "ETH",
    amountUsdc: "1000000",
    decision: "BLOCK_AND_COOLDOWN",
    policyVersion: "fomo-v1",
    marketMode: "historical_replay",
    marketSource: "test",
    unlockAt: 0,
    evidenceHash: `0x${"3".repeat(64)}`,
    evaluation: { decision: { action: "BLOCK_AND_COOLDOWN" } },
  });

  saveExecutionStep(intentId, "approve", execution("keeper-approve", "pending"));
  saveExecutionStep(intentId, "approve", execution("keeper-approve", "completed"));
  updateIntentUnlockAt(intentId, 1);
  saveExecutionStep(intentId, "lock", execution("keeper-lock", "completed"));

  const run = getIntentRun(intentId);
  assert.equal(run?.status, "LOCKED");
  assert.equal(run?.actions.approve?.executionId, "keeper-approve");
  assert.equal(run?.actions.lock?.receipts?.[0]?.verified, true);
  assert.equal(getLatestIntentRun()?.intentId, intentId);
  assert.equal(getLatestDueLockedIntent(2)?.intentId, intentId);

  saveExecutionStep(intentId, "refund", execution("keeper-refund", "completed"));
  assert.equal(getIntentRun(intentId)?.status, "REFUNDED");
  const bundle = buildProofBundle(intentId);
  assert.equal(bundle?.schema, "fomo-firewall-proof/v1");
  assert.match(String(bundle?.bundleHash), /^0x[0-9a-f]{64}$/);
});

test("records simulation rejection as a non-broadcast failure", () => {
  const failedIntentId = `0x${"4".repeat(64)}`;
  saveIntent({
    intentId: failedIntentId,
    requestId: "request-failed",
    sourceText: "Buy 1 USDC of ETH",
    asset: "ETH",
    amountUsdc: "1000000",
    decision: "BLOCK_AND_COOLDOWN",
    policyVersion: "fomo-v1",
    marketMode: "historical_replay",
    marketSource: "test",
    unlockAt: 0,
    evidenceHash: `0x${"5".repeat(64)}`,
    evaluation: { decision: { action: "BLOCK_AND_COOLDOWN" } },
  });
  saveSimulationFailure(failedIntentId, "lock", {
    success: false,
    status: "simulated",
    wouldRevert: true,
    error: "CooldownActive",
  });

  const run = getIntentRun(failedIntentId);
  assert.equal(run?.status, "FAILED");
  assert.equal(run?.actions.lock?.broadcasted, false);
  assert.equal(run?.actions.lock?.simulation?.wouldRevert, true);
});
