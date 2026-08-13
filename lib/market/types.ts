export type MarketMode = "historical_replay" | "live";

export type MarketSnapshot = {
  asset: "ETH";
  priceChange1hBps: bigint;
  priceUsd: string;
  observedAt: string;
  mode: MarketMode;
  source: string;
};

export interface MarketDataAdapter {
  getSnapshot(asset: "ETH"): Promise<MarketSnapshot>;
}
