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

  // Read the fabricated vendor-reply file. We deliberately fetch it over HTTP from the
  // deployment's own public URL rather than via fs.readFile(process.cwd() + "/public/...").
  // On Vercel, files under public/ are shipped as static CDN assets — they are NOT
  // guaranteed to be present on the serverless function's own filesystem, because
  // Next.js's build-time file tracer can't always tell that a dynamically-constructed
  // path (vendor.fileName comes from data, not a static import) needs to be bundled
  // into the function. That mismatch is invisible in local dev (which always has the
  // full filesystem) and shows up as every single extraction failing identically in
  // production. Fetching the public URL sidesteps the tracer entirely.
  let buffer: Buffer;
  try {
    const publicUrl = new URL(`/vendor-replies/${vendor.fileName}`, req.nextUrl.origin);
    const res = await fetch(publicUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (fetchErr) {
    // Fall back to a direct filesystem read (works in local dev and covers any
    // deployment target where the public URL fetch isn't viable, e.g. no network
    // egress from the function to its own domain).
    try {
      const filePath = path.join(process.cwd(), "public", "vendor-replies", vendor.fileName);
      buffer = await fs.readFile(filePath);
    } catch (fsErr) {
      console.error("Could not read vendor file", vendor.fileName, { fetchErr, fsErr });
      return NextResponse.json(
        { error: `Could not read vendor file at ${vendor.fileName} (tried HTTP and filesystem)` },
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
