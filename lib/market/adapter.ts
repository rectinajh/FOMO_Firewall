import { CoinbaseMarketAdapter } from "./live";
import { HistoricalReplayAdapter } from "./replay";
import type { MarketDataAdapter } from "./types";

export function getMarketAdapter(): MarketDataAdapter {
  return process.env.MARKET_MODE === "live" ? new CoinbaseMarketAdapter() : new HistoricalReplayAdapter();
}
