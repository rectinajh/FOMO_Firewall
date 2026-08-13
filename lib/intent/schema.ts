export type PurchaseIntent = {
  asset: "ETH";
  amountUsdc: bigint;
  action: "BUY";
  sourceText: string;
};

export type IntentParseResult =
  | { ok: true; intent: PurchaseIntent }
  | { ok: false; code: "UNSUPPORTED_ASSET" | "MISSING_AMOUNT" | "UNSUPPORTED_ACTION" | "INVALID_AMOUNT"; message: string };
