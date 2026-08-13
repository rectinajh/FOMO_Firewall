import type { MarketDataAdapter, MarketSnapshot } from "./types";

type CoinbaseCandle = [number, number, number, number, number, number];

export class CoinbaseMarketAdapter implements MarketDataAdapter {
  async getSnapshot(asset: "ETH"): Promise<MarketSnapshot> {
    const product = `${asset}-USD`;
    const response = await fetch(`https://api.exchange.coinbase.com/products/${product}/candles?granularity=3600`, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Market provider failed (${response.status})`);
    const candles = (await response.json()) as CoinbaseCandle[];
    if (candles.length < 2) throw new Error("Market provider returned too few candles");
    const latestClose = candles[0][4];
    const priorClose = candles[1][4];
    return {
      asset,
      priceChange1hBps: BigInt(Math.round(((latestClose - priorClose) / priorClose) * 100_000)),
      priceUsd: latestClose.toFixed(2),
      observedAt: new Date().toISOString(),
      mode: "live",
      source: `coinbase:${product}:3600`,
    };
  }
}
