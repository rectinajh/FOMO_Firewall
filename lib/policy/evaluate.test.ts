import { DEFAULT_POLICY, evaluateFomo } from "./evaluate";

const usdc = (value: number) => BigInt(value) * 1_000_000n;

describe("evaluateFomo", () => {
  it("blocks when both thresholds are met", () => {
    const result = evaluateFomo({ priceChange1hBps: 2_400n, amountUsdc: usdc(100) });
    expect(result.action).toBe("BLOCK_AND_COOLDOWN");
    expect(result.protectedAmount).toBe(usdc(100));
  });

  it("allows when price is below the threshold", () => {
    const result = evaluateFomo({ priceChange1hBps: 1_499n, amountUsdc: usdc(100) });
    expect(result.action).toBe("ALLOW");
    expect(result.reasonCodes).toContain("PRICE_CHANGE_WITHIN_LIMIT");
  });

  it("allows when amount is below the threshold", () => {
    const result = evaluateFomo({ priceChange1hBps: 2_400n, amountUsdc: usdc(49) });
    expect(result.action).toBe("ALLOW");
    expect(result.reasonCodes).toContain("AMOUNT_BELOW_GUARD_LIMIT");
  });

  it("treats both thresholds as inclusive", () => {
    const result = evaluateFomo({
      priceChange1hBps: DEFAULT_POLICY.maxChaseBps,
      amountUsdc: DEFAULT_POLICY.minimumGuardAmount,
    });
    expect(result.action).toBe("BLOCK_AND_COOLDOWN");
  });
});
