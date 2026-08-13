import { evaluateIntent } from "./orchestrator";

describe("evaluateIntent", () => {
  const market = {
    asset: "ETH" as const,
    priceChange1hBps: 2_400n,
    priceUsd: "3200.00",
    observedAt: "2026-08-12T13:00:00.000Z",
    mode: "historical_replay" as const,
    source: "demo-scenario/eth-pump-reversal",
  };

  it("returns an explainable block decision", () => {
    const result = evaluateIntent("ETH is pumping, I want to buy with 100 USDC", market);
    expect(result.decision.action).toBe("BLOCK_AND_COOLDOWN");
    expect(result.decision.reasonCodes).toEqual([
      "PRICE_CHANGE_THRESHOLD_BREACHED",
      "AMOUNT_THRESHOLD_BREACHED",
    ]);
    expect(result.explanation).toContain("24%");
    expect(result.explanation).toContain("100 USDC");
  });

  it("does not guard an amount below the minimum", () => {
    const result = evaluateIntent("I want to buy ETH with 10 USDC", market);
    expect(result.decision.action).toBe("ALLOW");
  });
});
