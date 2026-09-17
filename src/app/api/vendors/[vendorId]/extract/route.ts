import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getVendor } from "@/data/vendors";
import { parseVendorFile } from "@/lib/parsers";
import { extractVendorReply } from "@/lib/extraction";
import { normalizeLine } from "@/lib/normalize";
import type { Rfx, ExtractionResult } from "@/lib/types";
import rfxSeed from "@/data/rfx-seed.json";

// Vercel silently clamps this to whatever your plan actually allows (e.g. Hobby
// tops out around 60s, Pro up to 300s/800s depending on Fluid Compute), so
// requesting more than you're entitled to is harmless — it just uses the real
// ceiling instead of being artificially capped by this number.
export const maxDuration = 300;

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

  // Read the fabricated vendor-reply file directly off the function's filesystem.
  // Files under public/ aren't automatically part of a serverless function's own
  // bundle — Next.js's build-time file tracer can miss a dynamically-constructed
  // path like this one (vendor.fileName comes from data, not a static import) —
  // so next.config.ts explicitly forces public/vendor-replies/** into every
  // route's trace via outputFileTracingIncludes. With that in place this read is
  // instant and needs no network hop.
  let buffer: Buffer;
  try {
    const filePath = path.join(process.cwd(), "public", "vendor-replies", vendor.fileName);
    buffer = await fs.readFile(filePath);
  } catch (fsErr) {
    // Fallback only: fetch the file's own public URL. This is a real network
    // round-trip (the function calling back into its own deployment), which is
    // measurably slower and was previously eating into the extraction call's
    // time budget and causing FUNCTION_INVOCATION_TIMEOUT — so it's kept only
    // as a last resort, not the primary path.
    try {
      const publicUrl = new URL(`/vendor-replies/${vendor.fileName}`, req.nextUrl.origin);
      const res = await fetch(publicUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } catch (fetchErr) {
      console.error("Could not read vendor file", vendor.fileName, { fsErr, fetchErr });
      return NextResponse.json(
        { error: `Could not read vendor file at ${vendor.fileName} (tried filesystem and HTTP)` },
        { status: 500 }
      );
    }
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
