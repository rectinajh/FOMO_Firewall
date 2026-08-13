import { NextResponse } from "next/server";
import { evaluateIntent } from "../../../../lib/agent/orchestrator";
import { getLatestIntentRun, saveIntent } from "../../../../lib/evidence/store";
import { getMarketAdapter } from "../../../../lib/market/adapter";
import { demoPolicy } from "../../../../lib/policy/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

function isCompleteEvaluation(value: unknown): value is { intent: object; market: object; decision: object } {
  if (!value || typeof value !== "object") return false;
  const evaluation = value as Record<string, unknown>;
  return Boolean(evaluation.intent && evaluation.market && evaluation.decision);
}

export async function GET() {
  let run = getLatestIntentRun();
  if (!run) return NextResponse.json({ run: null });

  if (!isCompleteEvaluation(run.evaluation)) {
    const evaluation = evaluateIntent(
      run.sourceText,
      await getMarketAdapter().getSnapshot("ETH"),
      demoPolicy(),
    );
    saveIntent({
      intentId: run.intentId,
      requestId: run.requestId,
      sourceText: run.sourceText,
      asset: run.asset,
      amountUsdc: run.amountUsdc,
      decision: run.decision,
      policyVersion: run.policyVersion,
      marketMode: run.marketMode,
      marketSource: run.marketSource,
      unlockAt: run.unlockAt,
      evidenceHash: run.evidenceHash,
      evaluation: serialize(evaluation),
    });
    run = getLatestIntentRun();
    if (!run) return NextResponse.json({ run: null });
  }

  return NextResponse.json({
    run: {
      intentId: run.intentId,
      requestId: run.requestId,
      sourceText: run.sourceText,
      unlockAt: run.unlockAt,
      status: run.status,
      evaluation: run.evaluation,
      actions: run.actions,
      proofBundleUrl: `/api/evidence/${run.intentId}`,
      restored: true,
    },
  });
}
