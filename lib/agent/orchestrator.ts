import { evaluateFomo, type FomoPolicy, type PolicyDecision } from "../policy/evaluate";
import { parsePurchaseIntent } from "../intent/parser";
import type { PurchaseIntent } from "../intent/schema";

export type MarketSnapshot = {
  asset: "ETH";
  priceChange1hBps: bigint;
  priceUsd: string;
  observedAt: string;
  mode: "historical_replay" | "live";
  source: string;
};

export type EvaluationResult = {
  intent: PurchaseIntent;
  market: MarketSnapshot;
  decision: PolicyDecision;
  explanation: string;
};

export function evaluateIntent(
  sourceText: string,
  market: MarketSnapshot,
  policy?: FomoPolicy,
): EvaluationResult {
  const parsed = parsePurchaseIntent(sourceText);
  if (parsed.ok === false) {
    throw new Error(`${parsed.code}: ${parsed.message}`);
  }
  if (parsed.intent.asset !== market.asset) {
    throw new Error("Market snapshot asset does not match intent asset");
  }

  const decision = evaluateFomo({
    priceChange1hBps: market.priceChange1hBps,
    amountUsdc: parsed.intent.amountUsdc,
  }, policy);

  return {
    intent: parsed.intent,
    market,
    decision,
    explanation: explainDecision(parsed.intent, market, decision),
  };
}

function explainDecision(
  intent: PurchaseIntent,
  market: MarketSnapshot,
  decision: PolicyDecision,
): string {
  const change = formatPercent(market.priceChange1hBps);
  const amount = formatUsdc(intent.amountUsdc);
  if (decision.action === "BLOCK_AND_COOLDOWN") {
    return `ETH rose ${change} in the last hour and the planned ${amount} USDC exceeds the protection rule. The funds enter a ${decision.policyVersion} cooldown.`;
  }
  return `The planned ${amount} USDC purchase is within the precommitted protection rule. No vault action is required.`;
}

function formatUsdc(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}`;
}

function formatPercent(bps: bigint): string {
  const whole = bps / 100n;
  const fraction = (bps % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return `${whole}${fraction ? `.${fraction}` : ""}%`;
}
