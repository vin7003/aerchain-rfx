import { NextRequest, NextResponse } from "next/server";
import { askAnalyst } from "@/lib/analyst";
import type { Rfx, ExtractionResult, AnalystChatMessage } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const history: AnalystChatMessage[] = body?.history ?? [];
    const rfx: Rfx = body?.rfx;
    const extractions: ExtractionResult[] = body?.extractions ?? [];

    if (!rfx || extractions.length === 0) {
      return NextResponse.json({ error: "rfx and extractions are required" }, { status: 400 });
    }

    const result = await askAnalyst(history, rfx, extractions);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Analyst ask failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Analyst failed" }, { status: 500 });
  }
}
