import { parsePurchaseIntent } from "./parser";

describe("parsePurchaseIntent", () => {
  it("parses English purchase text", () => {
    const result = parsePurchaseIntent("ETH is pumping, I want to buy with 100 USDC");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.intent.amountUsdc).toBe(100_000_000n);
  });

  it("parses Chinese purchase text", () => {
    const result = parsePurchaseIntent("ETH 已经涨很多了，我想投入 12.5 USDC");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.intent.amountUsdc).toBe(12_500_000n);
  });

  it("rejects unsupported assets", () => {
    const result = parsePurchaseIntent("I want to buy BTC with 100 USDC");
    expect(result).toMatchObject({ ok: false, code: "UNSUPPORTED_ASSET" });
  });

  it("rejects missing amounts", () => {
    const result = parsePurchaseIntent("I want to buy ETH");
    expect(result).toMatchObject({ ok: false, code: "MISSING_AMOUNT" });
  });

  it("rejects amounts with more than six decimals", () => {
    const result = parsePurchaseIntent("I want to buy ETH with 1.1234567 USDC");
    expect(result).toMatchObject({ ok: false, code: "INVALID_AMOUNT" });
  });
});
