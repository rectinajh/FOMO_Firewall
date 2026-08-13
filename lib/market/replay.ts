import type { MarketDataAdapter, MarketSnapshot } from "./types";

export class HistoricalReplayAdapter implements MarketDataAdapter {
  constructor(private readonly scenario = { priceChange1hBps: 2_400n, priceUsd: "3200.00", source: "demo-scenario/eth-pump-reversal" }) {}

  async getSnapshot(asset: "ETH"): Promise<MarketSnapshot> {
    return { asset, ...this.scenario, observedAt: new Date().toISOString(), mode: "historical_replay" };
  }
}
