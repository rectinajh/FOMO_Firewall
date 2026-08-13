import { NextResponse } from "next/server";
import { z } from "zod";
import { isSimulationRejection, settleIntent, SettlementError } from "../../../../lib/agent/settlement";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  intentId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export async function POST(request: Request) {
  try {
    const { intentId } = requestSchema.parse(await request.json());
    return NextResponse.json(await settleIntent(intentId));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", details: error.flatten() }, { status: 400 });
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
    return NextResponse.json(
      { error: "REFUND_EXECUTION_FAILED", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 },
    );
  }
}
