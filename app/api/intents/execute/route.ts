import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateIntent } from "../../../../lib/agent/orchestrator";
import { approveUsdc, createIntent, readUsdcBalance } from "../../../../lib/keeperhub/execute";
import { KeeperHubSimulationError, waitForExecution } from "../../../../lib/keeperhub/client";
import type { ExecutionStatus } from "../../../../lib/keeperhub/types";
import { demoPolicy } from "../../../../lib/policy/config";
import { getMarketAdapter } from "../../../../lib/market/adapter";
import {
  getIntentRun,
  saveExecutionStep,
  saveIntent,
  saveSimulationFailure,
  updateIntentUnlockAt,
} from "../../../../lib/evidence/store";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(1_000),
  requestId: z.string().trim().min(8).max(100),
});

function hexId(label: string): string {
  return `0x${createHash("sha256").update(label).digest("hex")}`;
}

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

function isCompleteEvaluation(value: unknown): value is ReturnType<typeof evaluateIntent> {
  if (!value || typeof value !== "object") return false;
  const evaluation = value as Record<string, unknown>;
  return Boolean(evaluation.intent && evaluation.market && evaluation.decision);
}

async function completeStep(
  intentId: string,
  step: "approve" | "lock",
  submitted: ExecutionStatus,
): Promise<ExecutionStatus> {
  saveExecutionStep(intentId, step, submitted);
  if (submitted.status === "completed" || submitted.status === "failed") return submitted;
  const finalStatus = await waitForExecution(submitted.executionId);
  const completed = {
    ...finalStatus,
    simulation: submitted.simulation,
    broadcasted: submitted.broadcasted ?? true,
  };
  saveExecutionStep(intentId, step, completed);
  return completed;
}

function responseFromStoredRun(run: NonNullable<ReturnType<typeof getIntentRun>>) {
  return serialize({
    intentId: run.intentId,
    unlockAt: run.unlockAt,
    evaluation: run.evaluation,
    status: run.status,
    recovered: true,
    actions: {
      approve: run.actions.approve,
      lock: run.actions.lock,
    },
  });
}

export async function POST(request: Request) {
  let activeIntentId: string | null = null;
  let activeStep: "approve" | "lock" = "approve";
  try {
    const { text, requestId } = requestSchema.parse(await request.json());
    const intentId = hexId(`intent:${requestId}:${text}`);
    activeIntentId = intentId;
    const stored = getIntentRun(intentId);
    if (stored?.actions.lock?.status === "completed") {
      return NextResponse.json(responseFromStoredRun(stored));
    }

    const evaluation = isCompleteEvaluation(stored?.evaluation)
      ? stored.evaluation
      : evaluateIntent(text, await getMarketAdapter().getSnapshot("ETH"), demoPolicy());

    if (evaluation.decision.action !== "BLOCK_AND_COOLDOWN") {
      return NextResponse.json({ error: "PROTECTION_NOT_REQUIRED", evaluation }, { status: 409 });
    }

    const evidenceHash = stored?.evidenceHash || hexId(JSON.stringify({
      text,
      requestId,
      intentId,
      priceChange1hBps: evaluation.market.priceChange1hBps.toString(),
      amountUsdc: evaluation.intent.amountUsdc.toString(),
    }));
    const amount = evaluation.intent.amountUsdc.toString();
    saveIntent({
      intentId,
      requestId,
      sourceText: text,
      asset: evaluation.intent.asset,
      amountUsdc: amount,
      decision: evaluation.decision.action,
      policyVersion: evaluation.decision.policyVersion,
      marketMode: evaluation.market.mode,
      marketSource: evaluation.market.source,
      unlockAt: stored?.unlockAt || 0,
      evidenceHash,
      evaluation: serialize(evaluation),
    });

    const walletAddress = process.env.KEEPERHUB_WALLET_ADDRESS;
    if (!walletAddress) throw new Error("Missing KEEPERHUB_WALLET_ADDRESS");
    let approvalStatus = stored?.actions.approve;
    if (!approvalStatus || approvalStatus.status !== "completed") {
      if (!approvalStatus) {
        const balanceResponse = await readUsdcBalance(walletAddress);
        const available = BigInt(String(balanceResponse.result ?? "0"));
        if (available < evaluation.intent.amountUsdc) {
          const availableDisplay = (Number(available) / 1_000_000).toFixed(2);
          const requestedDisplay = (Number(evaluation.intent.amountUsdc) / 1_000_000).toFixed(2);
          return NextResponse.json({
            error: "INSUFFICIENT_USDC_BALANCE",
            detail: `KeeperHub wallet has ${availableDisplay} USDC, but this intent requires ${requestedDisplay} USDC. Fund the wallet or reduce the amount.`,
            availableUsdc: availableDisplay,
            requestedUsdc: requestedDisplay,
            broadcasted: false,
          }, { status: 409 });
        }
        approvalStatus = await approveUsdc(amount, `fomo:${intentId}:approve`);
      }
      approvalStatus = await completeStep(intentId, "approve", approvalStatus);
    }
    if (approvalStatus.status !== "completed") {
      throw new Error(approvalStatus.error || approvalStatus.detail || `USDC approval failed: ${approvalStatus.executionId}`);
    }

    // The approval is a separate onchain transaction. Calculate after it settles,
    // then leave a small buffer for createIntent simulation and broadcast.
    const cooldown = Number(process.env.DEMO_COOLDOWN_SECONDS || "1");
    const executionBuffer = Number(process.env.DEMO_EXECUTION_BUFFER_SECONDS || "15");
    const unlockAt = stored?.unlockAt && stored.unlockAt > Math.floor(Date.now() / 1000)
      ? stored.unlockAt
      : Math.floor(Date.now() / 1000) + Math.max(1, cooldown) + Math.max(0, executionBuffer);
    updateIntentUnlockAt(intentId, unlockAt);

    let lockStatus = stored?.actions.lock;
    activeStep = "lock";
    if (!lockStatus || lockStatus.status !== "completed") {
      if (!lockStatus) {
        lockStatus = await createIntent(
          intentId,
          amount,
          unlockAt,
          evidenceHash,
          `fomo:${intentId}:lock`,
        );
      }
      lockStatus = await completeStep(intentId, "lock", lockStatus);
    }
    if (lockStatus.status !== "completed") {
      throw new Error(lockStatus.error || lockStatus.detail || `Vault lock failed: ${lockStatus.executionId}`);
    }

    return NextResponse.json(serialize({
      intentId,
      unlockAt,
      status: "LOCKED",
      evaluation,
      actions: {
        approve: approvalStatus,
        lock: lockStatus,
      },
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", details: error.flatten() }, { status: 400 });
    }
    if (error instanceof KeeperHubSimulationError) {
      if (activeIntentId) saveSimulationFailure(activeIntentId, activeStep, error.simulation);
      return NextResponse.json({
        error: "SIMULATION_REJECTED",
        detail: error.message,
        broadcasted: false,
        simulation: error.simulation,
      }, { status: 422 });
    }
    return NextResponse.json(
      { error: "PROTECTION_EXECUTION_FAILED", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 },
    );
  }
}
