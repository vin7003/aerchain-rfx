// Deterministic normalization — intentionally NOT done by the LLM. The model's
// job is to read messy documents and tell us what a vendor actually said; once
// we have that, converting currency and price-basis is arithmetic, not
// judgment, and arithmetic should not be left to a language model where a
// buyer might act on the result.
import type { ExtractedLine, Rfx } from "./types";

// Placeholder indicative rate — swap for a treasury-approved / live FX feed
// in a real deployment. Surfaced explicitly in the UI, never applied silently.
export const USD_TO_INR = 83.5;

function boxSurfaceAreaM2(dimensionsMm: string): number {
  const [l, w, h] = dimensionsMm.split("x").map((s) => parseInt(s.trim(), 10));
  return (2 * (l * w + l * h + w * h)) / 1_000_000;
}

export type NormalizedLine = ExtractedLine & {
  normalizationNote: string | null;
  normalizedConfidencePenalty: boolean;
};

export function normalizeLine(line: ExtractedLine, rfx: Rfx): NormalizedLine {
  if (line.unitPrice === null || !line.rfxCode) {
    return { ...line, normalizationNote: null, normalizedConfidencePenalty: false };
  }

  const rfxLine = rfx.lineItems.find((li) => li.code === line.rfxCode);
  let inr = line.unitPrice;
  const notes: string[] = [];
  let penalty = false;

  // 1. currency
  const currency = (line.currency || "INR").toUpperCase();
  if (currency === "USD") {
    inr = inr * USD_TO_INR;
    notes.push(`Converted from USD at an indicative rate of ₹${USD_TO_INR}/$1 (not a live/treasury rate).`);
  } else if (currency !== "INR") {
    notes.push(`Unrecognized currency "${line.currency}" — treated as INR without conversion. Verify.`);
    penalty = true;
  }

  // 2. price basis
  if (line.priceBasis === "per_100_pieces") {
    inr = inr / 100;
    notes.push("Converted from a per-100-pieces rate to per box (÷100).");
  } else if (line.priceBasis === "per_kg") {
    if (rfxLine) {
      const sa = boxSurfaceAreaM2(rfxLine.dimensionsMm);
      const estWeightKg = (sa * rfxLine.boardGsm) / 1000;
      inr = inr * estWeightKg;
      notes.push(
        `Vendor quoted per kg. Box weight was not stated, so it was estimated from board area × GSM (≈${estWeightKg.toFixed(3)} kg/box) — this ignores flute/corrugation and glue weight, so treat as approximate.`
      );
      penalty = true;
    } else {
      notes.push("Vendor quoted per kg but the RFx line couldn't be matched, so no weight estimate was possible.");
      penalty = true;
    }
  } else if (line.priceBasis === "unknown") {
    notes.push("Vendor's pricing basis is unclear — normalized value is not reliable.");
    penalty = true;
  }

  return {
    ...line,
    normalizedUnitPriceInr: Math.round(inr * 100) / 100,
    normalizationNote: notes.length ? notes.join(" ") : null,
    normalizedConfidencePenalty: penalty,
  };
}

export function effectiveConfidence(line: NormalizedLine): "high" | "medium" | "low" | "missing" {
  if (line.unitPrice === null) return "missing";
  if (line.normalizedConfidencePenalty && line.confidence === "high") return "medium";
  if (line.normalizedConfidencePenalty && line.confidence === "medium") return "low";
  return line.confidence;
}
