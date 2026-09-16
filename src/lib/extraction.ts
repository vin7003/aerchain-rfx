import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL } from "./anthropic";
import type { ParsedDocument } from "./parsers";
import type { Rfx, ExtractedLine, ExtractionResult } from "./types";

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_extraction",
  description:
    "Record everything you were able to extract from this vendor's reply document, mapped against the buyer's RFx.",
  input_schema: {
    type: "object",
    properties: {
      lines: {
        type: "array",
        description:
          "One entry per (RFx line item, or unmatched vendor line). If the vendor's document states a rule that covers multiple RFx line items (e.g. 'Rs 38/kg for all 3-ply boxes'), emit one entry per RFx line item it covers, reusing the same sourceQuote. If a price genuinely cannot be determined (vendor deferred to a value you don't have, like 'same as last year'), still emit the line with unitPrice null and explain why in notes.",
        items: {
          type: "object",
          properties: {
            rfxCode: {
              type: ["string", "null"],
              description: "The buyer's RFx line code (e.g. PKG-014) this vendor line maps to, or null if it doesn't match anything on the RFx.",
            },
            vendorLabel: {
              type: "string",
              description: "How the vendor referred to this item, in their own words/format.",
            },
            unitPrice: {
              type: ["number", "null"],
              description: "The numeric price exactly as stated by the vendor for this basis (not converted). Null if not resolvable.",
            },
            currency: {
              type: "string",
              description: "Currency code as stated or implied, e.g. INR, USD.",
            },
            priceBasis: {
              type: "string",
              enum: ["per_box", "per_100_pieces", "per_kg", "unknown"],
              description: "The unit the price is quoted against, exactly as the vendor stated it.",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Your confidence that this rfxCode mapping and price are correct.",
            },
            notes: {
              type: "string",
              description: "Anything the buyer should know: ambiguity, assumptions you made, why confidence is low, what data would resolve it.",
            },
            sourceQuote: {
              type: "string",
              description: "The exact snippet, cell, or sentence this was read from, so a human can verify it against the source.",
            },
          },
          required: ["rfxCode", "vendorLabel", "unitPrice", "currency", "priceBasis", "confidence", "notes", "sourceQuote"],
        },
      },
      unresolvedNotes: {
        type: "array",
        items: { type: "string" },
        description: "Anything on the RFx this vendor's document never addresses at all.",
      },
      questionnaireAnswers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            questionId: { type: "string" },
            answer: { type: "string" },
            sourceQuote: { type: "string" },
          },
          required: ["questionId", "answer", "sourceQuote"],
        },
      },
      commercialTerms: {
        type: "object",
        properties: {
          payment: { type: ["string", "null"] },
          delivery: { type: ["string", "null"] },
          validity: { type: ["string", "null"] },
          otherNotes: { type: "array", items: { type: "string" } },
        },
        required: ["payment", "delivery", "validity", "otherNotes"],
      },
      globalFlags: {
        type: "array",
        items: { type: "string" },
        description: "Document-wide things the buyer must not miss: discounts in footnotes, taxes excluded, non-standard payment terms, etc.",
      },
      rawModelNotes: {
        type: "string",
        description: "2-4 sentences on how you approached this document and what made it easy or hard.",
      },
    },
    required: ["lines", "unresolvedNotes", "questionnaireAnswers", "commercialTerms", "globalFlags", "rawModelNotes"],
  },
};

function systemPrompt(rfx: Rfx): string {
  return `You are the extraction engine inside a procurement platform. A buyer (${rfx.buyerCompany}) sent an RFx to several vendors for corrugated packaging. Vendors reply however they like — spreadsheets that ignore the template, PDFs, Word docs, photographed rate cards, plain emails. Your job is to read ONE vendor's reply and extract structured pricing and questionnaire data against the buyer's RFx, honestly.

Rules:
- Never invent a number. If the vendor gave no number at all for something (e.g. "same as last year" with no figure), leave unitPrice null and explain in notes what's missing.
- If the vendor DID give a number, but against a unit other than "per box" (per kg, per 100 pieces, per lb, etc.), report that number as unitPrice exactly as stated and set priceBasis accordingly — even if you personally cannot convert it to a per-box price. Converting units is handled by a separate deterministic step downstream; your job is to faithfully capture what the vendor said, not to do that arithmetic yourself. Only use priceBasis "unknown" with unitPrice null when there is truly no figure to report.
- Do not silently resolve ambiguity in the vendor's favor or the buyer's favor. Surface it.
- Match vendor line items to the buyer's RFx codes using the dimensions, ply, GSM and description as your key, not just similar wording. Be conservative: if you're not sure two things are the same box, say so at lower confidence rather than guessing "high".
- If a vendor states a rule covering many RFx lines at once (e.g. a blanket rate for all 3-ply boxes, or "same as last year" for a category), apply it to every RFx line item in that category and cite the same source quote for each.
- Always include the literal source text/cell you relied on in sourceQuote, so a human can check your work.

The buyer's RFx line items (code | description | dimensions mm | ply | board GSM | print | qty | uom):
${rfx.lineItems.map((li) => `${li.code} | ${li.description} | ${li.dimensionsMm} | ${li.ply} | ${li.boardGsm} | ${li.print} | ${li.qty} | ${li.uom}`).join("\n")}

The buyer's questionnaire:
${rfx.questionnaire.map((q) => `${q.id}: ${q.question}`).join("\n")}

Requested commercial terms: ${JSON.stringify(rfx.termsRequested)}
Requested currency: ${rfx.currency}

Now read the vendor's document (provided next) and call record_extraction with everything you found.`;
}

export async function extractVendorReply(
  rfx: Rfx,
  vendorName: string,
  doc: ParsedDocument
): Promise<Omit<ExtractionResult, "vendorId" | "extractedAt">> {
  const client = getClient();

  const content: Anthropic.MessageParam["content"] =
    doc.kind === "text"
      ? [
          {
            type: "text",
            text: `Vendor: ${vendorName}\n\nDocument content:\n${doc.text}`,
          },
        ]
      : [
          { type: "text", text: `Vendor: ${vendorName}\n\nDocument is an image (see attached). It may be photographed at an angle — read it carefully, row by row.` },
          {
            type: "image",
            source: { type: "base64", media_type: doc.mediaType as "image/jpeg", data: doc.base64 },
          },
        ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: systemPrompt(rfx),
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_extraction" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) {
    throw new Error("Model did not return a tool_use block for extraction.");
  }
  const parsed = toolUse.input as {
    lines: ExtractedLine[];
    unresolvedNotes: string[];
    questionnaireAnswers: { questionId: string; answer: string; sourceQuote: string }[];
    commercialTerms: ExtractionResult["commercialTerms"];
    globalFlags: string[];
    rawModelNotes: string;
  };

  // normalizedUnitPriceInr is computed deterministically by our own code, not
  // the model — see normalize.ts. Leave it null here; the route fills it in.
  const lines: ExtractedLine[] = parsed.lines.map((l) => ({ ...l, normalizedUnitPriceInr: null }));

  return { ...parsed, lines };
}
