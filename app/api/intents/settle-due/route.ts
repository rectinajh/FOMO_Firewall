import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isSimulationRejection,
  settleIntent,
  settleLatestDueIntent,
  SettlementError,
} from "../../../../lib/agent/settlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const requestSchema = z.object({
  intentId: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
});

export async function POST(request: Request) {
  if (process.env.DEMO_AUTO_SETTLE === "false") {
    return NextResponse.json({ settled: false, reason: "AUTO_SETTLEMENT_DISABLED" }, { status: 409 });
  }
  try {
    const raw = await request.text();
    const body = requestSchema.parse(raw ? JSON.parse(raw) : {});
    const result = body.intentId ? await settleIntent(body.intentId) : await settleLatestDueIntent();
    if (!result) return NextResponse.json({ settled: false, reason: "NO_DUE_INTENT" });
    return NextResponse.json({ settled: true, trigger: "agent_loop", ...result });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "INVALID_REQUEST", broadcasted: false }, { status: 400 });
    }
    if (error instanceof SettlementError) {
      return NextResponse.json(
        { error: error.code, detail: error.message, unlockAt: error.unlockAt, broadcasted: false },
        { status: error.statusCode },
      );
    }
    if (isSimulationRejection(error)) {
      return NextResponse.json({
        error: "SIMULATION_REJECTED",
        detail: error.message,
        broadcasted: false,
        simulation: error.simulation,
      }, { status: 422 });
    }
    return NextResponse.json({
      error: "AUTO_SETTLEMENT_FAILED",
      detail: error instanceof Error ? error.message : "Unknown error",
    }, { status: 502 });
  }
}
