import type { IntentParseResult, PurchaseIntent } from "./schema";

const AMOUNT_PATTERN = /(\d+(?:\.\d+)?)\s*(?:USDC|USD|美元|美金)/i;

export function parsePurchaseIntent(sourceText: string): IntentParseResult {
  const text = sourceText.trim();
  if (!text) {
    return { ok: false, code: "MISSING_AMOUNT", message: "Intent text is empty" };
  }

  const mentionsEth = /\bETH\b|以太坊|以太币/i.test(text);
  if (!mentionsEth) {
    return { ok: false, code: "UNSUPPORTED_ASSET", message: "MVP only supports ETH" };
  }

  const mentionsBuy = /buy|purchase|投入|买入|购买|加仓/i.test(text);
  if (!mentionsBuy) {
    return { ok: false, code: "UNSUPPORTED_ACTION", message: "Only purchase intents are supported" };
  }

  const match = text.match(AMOUNT_PATTERN);
  if (!match) {
    return { ok: false, code: "MISSING_AMOUNT", message: "Could not find a USDC amount" };
  }

  const amountUsdc = decimalUsdcToBaseUnits(match[1]);
  if (amountUsdc === null || amountUsdc <= 0n) {
    return { ok: false, code: "INVALID_AMOUNT", message: "Amount must be a positive USDC value" };
  }

  const intent: PurchaseIntent = {
    asset: "ETH",
    amountUsdc,
    action: "BUY",
    sourceText: text,
  };
  return { ok: true, intent };
}

function decimalUsdcToBaseUnits(value: string): bigint | null {
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > 6) return null;
  const paddedFraction = fraction.padEnd(6, "0");
  try {
    return BigInt(whole) * 1_000_000n + BigInt(paddedFraction || "0");
  } catch {
    return null;
  }
}
