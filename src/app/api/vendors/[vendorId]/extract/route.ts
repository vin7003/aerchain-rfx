import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getVendor } from "@/data/vendors";
import { parseVendorFile } from "@/lib/parsers";
import { extractVendorReply } from "@/lib/extraction";
import { normalizeLine } from "@/lib/normalize";
import type { Rfx, ExtractionResult } from "@/lib/types";
import rfxSeed from "@/data/rfx-seed.json";

export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await ctx.params;
  const vendor = getVendor(vendorId);
  if (!vendor) {
    return NextResponse.json({ error: `Unknown vendor ${vendorId}` }, { status: 404 });
  }

  let rfx: Rfx = rfxSeed as unknown as Rfx;
  try {
    const body = await req.json();
    if (body?.rfx) rfx = body.rfx as Rfx;
  } catch {
    // no body / not JSON — fine, use the seed RFx
  }

  const filePath = path.join(process.cwd(), "public", "vendor-replies", vendor.fileName);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch {
    return NextResponse.json({ error: `Could not read vendor file at ${vendor.fileName}` }, { status: 500 });
  }

  try {
    const doc = await parseVendorFile(buffer, vendor.fileType, vendor.mimeType);
    const extracted = await extractVendorReply(rfx, vendor.name, doc);

    const normalizedLines = extracted.lines.map((l) => normalizeLine(l, rfx));

    const result: ExtractionResult & { normalizedLines: ReturnType<typeof normalizeLine>[] } = {
      vendorId: vendor.id,
      extractedAt: new Date().toISOString(),
      lines: extracted.lines,
      normalizedLines,
      unresolvedNotes: extracted.unresolvedNotes,
      questionnaireAnswers: extracted.questionnaireAnswers,
      commercialTerms: extracted.commercialTerms,
      globalFlags: extracted.globalFlags,
      rawModelNotes: extracted.rawModelNotes,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Extraction failed for", vendorId, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Extraction failed" },
      { status: 500 }
    );
  }
}
