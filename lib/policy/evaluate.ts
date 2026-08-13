export const POLICY_VERSION = "fomo-v1";

export type FomoPolicy = {
  maxChaseBps: bigint;
  minimumGuardAmount: bigint;
  protectionBps: bigint;
};

export type PolicyInput = {
  priceChange1hBps: bigint;
  amountUsdc: bigint;
};

export type PolicyDecision =
  | {
      action: "ALLOW";
      policyVersion: string;
      reasonCodes: string[];
      protectedAmount: bigint;
    }
  | {
      action: "BLOCK_AND_COOLDOWN";
      policyVersion: string;
      reasonCodes: string[];
      protectedAmount: bigint;
    };

export const DEFAULT_POLICY: FomoPolicy = {
  maxChaseBps: 1_500n, // 15%
  minimumGuardAmount: 50_000_000n, // 50 USDC, 6 decimals
  protectionBps: 10_000n, // 100%
};

export function evaluateFomo(
  input: PolicyInput,
  policy: FomoPolicy = DEFAULT_POLICY,
): PolicyDecision {
  validatePolicy(policy);
  if (input.priceChange1hBps < 0n) throw new Error("priceChange1hBps cannot be negative");
  if (input.amountUsdc <= 0n) throw new Error("amountUsdc must be positive");

  const priceThresholdBreached = input.priceChange1hBps >= policy.maxChaseBps;
  const amountThresholdBreached = input.amountUsdc >= policy.minimumGuardAmount;
  const protectedAmount = (input.amountUsdc * policy.protectionBps) / 10_000n;

  if (priceThresholdBreached && amountThresholdBreached) {
    return {
      action: "BLOCK_AND_COOLDOWN",
      policyVersion: POLICY_VERSION,
      reasonCodes: ["PRICE_CHANGE_THRESHOLD_BREACHED", "AMOUNT_THRESHOLD_BREACHED"],
      protectedAmount,
    };
  }

  const reasonCodes: string[] = [];
  if (!priceThresholdBreached) reasonCodes.push("PRICE_CHANGE_WITHIN_LIMIT");
  if (!amountThresholdBreached) reasonCodes.push("AMOUNT_BELOW_GUARD_LIMIT");

  return {
    action: "ALLOW",
    policyVersion: POLICY_VERSION,
    reasonCodes,
    protectedAmount: 0n,
  };
}

function validatePolicy(policy: FomoPolicy): void {
  if (policy.maxChaseBps < 0n || policy.maxChaseBps > 100_000n) {
    throw new Error("maxChaseBps must be between 0 and 100000");
  }
  if (policy.minimumGuardAmount <= 0n) {
    throw new Error("minimumGuardAmount must be positive");
  }
  if (policy.protectionBps < 0n || policy.protectionBps > 10_000n) {
    throw new Error("protectionBps must be between 0 and 10000");
  }
}
