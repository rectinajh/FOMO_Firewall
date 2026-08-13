import { DEFAULT_POLICY, type FomoPolicy } from "./evaluate";

export function demoPolicy(): FomoPolicy {
  const minimum = process.env.DEMO_MINIMUM_GUARD_AMOUNT_USDC || "1";
  return {
    ...DEFAULT_POLICY,
    minimumGuardAmount: BigInt(minimum) * 1_000_000n,
  };
}
