import {
  getIntentRun,
  getLatestDueLockedIntent,
  saveExecutionStep,
  saveSimulationFailure,
  updateIntentStatus,
} from "../evidence/store";
import { KeeperHubSimulationError, waitForExecution } from "../keeperhub/client";
import { readIntent, refundIntent } from "../keeperhub/execute";
import type { ExecutionStatus } from "../keeperhub/types";

export class SettlementError extends Error {
  constructor(
    readonly code: "INTENT_NOT_FOUND" | "INTENT_NOT_LOCKED" | "COOLDOWN_ACTIVE",
    message: string,
    readonly statusCode: number,
    readonly unlockAt?: number,
  ) {
    super(message);
    this.name = "SettlementError";
  }
}

export async function settleIntent(intentId: string): Promise<{
  intentId: string;
  unlockAt: number;
  refund: ExecutionStatus | null;
  recovered: boolean;
}> {
  const stored = getIntentRun(intentId);
  if (!stored) throw new SettlementError("INTENT_NOT_FOUND", "Intent was not found", 404);
  if (stored.actions.refund?.status === "completed") {
    return { intentId, unlockAt: stored.unlockAt, refund: stored.actions.refund, recovered: true };
  }

  const current = await readIntent(intentId);
  const chainIntent = current.result as { status?: string; unlockAt?: string } | undefined;
  if (chainIntent?.status === "2") {
    updateIntentStatus(intentId, "REFUNDED");
    return { intentId, unlockAt: Number(chainIntent.unlockAt), refund: stored.actions.refund || null, recovered: true };
  }
  if (!chainIntent || chainIntent.status !== "1") {
    throw new SettlementError("INTENT_NOT_LOCKED", "Intent is not currently locked", 409);
  }

  const unlockAt = Number(chainIntent.unlockAt);
  if (!Number.isSafeInteger(unlockAt) || Math.floor(Date.now() / 1_000) < unlockAt) {
    throw new SettlementError("COOLDOWN_ACTIVE", "The onchain cooldown is still active", 409, unlockAt);
  }

  let refundStatus = stored.actions.refund;
  if (!refundStatus) {
    try {
      refundStatus = await refundIntent(intentId, `fomo:${intentId}:refund`);
    } catch (error) {
      if (error instanceof KeeperHubSimulationError) {
        saveSimulationFailure(intentId, "refund", error.simulation);
      }
      throw error;
    }
    saveExecutionStep(intentId, "refund", refundStatus);
  }
  if (refundStatus.status !== "completed" && refundStatus.status !== "failed") {
    const finalStatus = await waitForExecution(refundStatus.executionId);
    refundStatus = {
      ...finalStatus,
      simulation: refundStatus.simulation,
      broadcasted: refundStatus.broadcasted ?? true,
    };
    saveExecutionStep(intentId, "refund", refundStatus);
  }
  if (refundStatus.status !== "completed") {
    throw new Error(
      refundStatus.error || refundStatus.detail || `Vault refund failed: ${refundStatus.executionId}`,
    );
  }

  return { intentId, unlockAt, refund: refundStatus, recovered: false };
}

export async function settleLatestDueIntent() {
  const due = getLatestDueLockedIntent();
  if (!due) return null;
  return settleIntent(due.intentId);
}

export function isSimulationRejection(error: unknown): error is KeeperHubSimulationError {
  return error instanceof KeeperHubSimulationError;
}
