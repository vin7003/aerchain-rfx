import { NextRequest, NextResponse } from "next/server";
import { draftRfxTurn, type ChatTurn } from "@/lib/rfx-copilot";

export const maxDuration = 300; // Vercel clamps this to your plan's actual ceiling — safe to raise

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const history: ChatTurn[] = body?.history ?? [];
    if (!Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ error: "history is required" }, { status: 400 });
    }
    const result = await draftRfxTurn(history);
    return NextResponse.json(result);
  } catch (err) {
    console.error("RFx draft turn failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Draft failed" }, { status: 500 });
  }
}
