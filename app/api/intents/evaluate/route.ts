import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateIntent } from "../../../../lib/agent/orchestrator";
import { demoPolicy } from "../../../../lib/policy/config";
import { getMarketAdapter } from "../../../../lib/market/adapter";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(1_000),
  market: z
    .object({
      priceChange1hBps: z.coerce.bigint().nonnegative(),
      priceUsd: z.string().regex(/^\d+(\.\d+)?$/),
      observedAt: z.string().datetime().optional(),
      mode: z.enum(["historical_replay", "live"]).default("historical_replay"),
      source: z.string().min(1).max(200).default("api-input"),
    })
    .optional(),
});

function serialize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const snapshot = body.market
      ? { asset: "ETH" as const, priceChange1hBps: body.market.priceChange1hBps, priceUsd: body.market.priceUsd, observedAt: body.market.observedAt ?? new Date().toISOString(), mode: body.market.mode, source: body.market.source }
      : await getMarketAdapter().getSnapshot("ETH");
    const result = evaluateIntent(body.text, snapshot, demoPolicy());

    return NextResponse.json(serialize({
      ...result,
      cooldownSeconds: Number(process.env.DEMO_EVALUATION_COOLDOWN_SECONDS || "5"),
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { error: "INTENT_EVALUATION_FAILED", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 422 },
    );
  }
}
