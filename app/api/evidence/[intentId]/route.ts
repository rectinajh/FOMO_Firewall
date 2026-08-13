import { NextResponse } from "next/server";
import { z } from "zod";
import { buildProofBundle } from "../../../../lib/evidence/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const intentIdSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

export async function GET(
  _request: Request,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId: rawIntentId } = await context.params;
  const parsed = intentIdSchema.safeParse(rawIntentId);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INTENT_ID" }, { status: 400 });
  }
  const bundle = buildProofBundle(parsed.data);
  if (!bundle) return NextResponse.json({ error: "INTENT_NOT_FOUND" }, { status: 404 });

  return new NextResponse(`${JSON.stringify(bundle, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fomo-proof-${parsed.data.slice(2, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
