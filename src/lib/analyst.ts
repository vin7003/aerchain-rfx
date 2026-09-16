import vm from "node:vm";
import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL } from "./anthropic";
import type { Rfx, ExtractionResult, AnalystChatMessage } from "./types";
import { normalizeLine, effectiveConfidence } from "./normalize";
import { getVendor } from "@/data/vendors";

export type AnalystRow = {
  rfxCode: string;
  description: string;
  ply: number;
  boardGsm: number;
  print: string;
  qty: number;
  vendorId: string;
  vendorName: string;
  unitPriceInr: number | null;
  extendedPriceInr: number | null; // unitPriceInr * qty
  confidence: "high" | "medium" | "low" | "missing";
  notes: string;
  sourceQuote: string;
};

export type VendorSummary = {
  vendorId: string;
  vendorName: string;
  questionnaireAnswers: Record<string, string>;
  commercialTerms: ExtractionResult["commercialTerms"];
  globalFlags: string[];
  linesCovered: number;
  linesTotal: number;
};

export function buildDataset(rfx: Rfx, extractions: ExtractionResult[]) {
  const rows: AnalystRow[] = [];
  const vendorMeta: VendorSummary[] = [];

  for (const ext of extractions) {
    const vendor = getVendor(ext.vendorId);
    const vendorName = vendor?.name ?? ext.vendorId;
    let covered = 0;

    for (const li of rfx.lineItems) {
      const rawLine = ext.lines.find((l) => l.rfxCode === li.code);
      if (!rawLine) {
        rows.push({
          rfxCode: li.code,
          description: li.description,
          ply: li.ply,
          boardGsm: li.boardGsm,
          print: li.print,
          qty: li.qty,
          vendorId: ext.vendorId,
          vendorName,
          unitPriceInr: null,
          extendedPriceInr: null,
          confidence: "missing",
          notes: "Vendor's reply never addressed this line item.",
          sourceQuote: "",
        });
        continue;
      }
      const normalized = normalizeLine(rawLine, rfx);
      const conf = effectiveConfidence(normalized);
      if (normalized.normalizedUnitPriceInr !== null) covered++;
      rows.push({
        rfxCode: li.code,
        description: li.description,
        ply: li.ply,
        boardGsm: li.boardGsm,
        print: li.print,
        qty: li.qty,
        vendorId: ext.vendorId,
        vendorName,
        unitPriceInr: normalized.normalizedUnitPriceInr,
        extendedPriceInr:
          normalized.normalizedUnitPriceInr !== null ? Math.round(normalized.normalizedUnitPriceInr * li.qty * 100) / 100 : null,
        confidence: conf,
        notes: [normalized.notes, normalized.normalizationNote].filter(Boolean).join(" "),
        sourceQuote: normalized.sourceQuote,
      });
    }

    vendorMeta.push({
      vendorId: ext.vendorId,
      vendorName,
      questionnaireAnswers: Object.fromEntries(ext.questionnaireAnswers.map((q) => [q.questionId, q.answer])),
      commercialTerms: ext.commercialTerms,
      globalFlags: ext.globalFlags,
      linesCovered: covered,
      linesTotal: rfx.lineItems.length,
    });
  }

  return { rows, vendorMeta };
}

const COMPUTE_TOOL: Anthropic.Tool = {
  name: "compute",
  description:
    "Run JavaScript over the real comparison dataset to answer analytical questions precisely. Never estimate arithmetic yourself — always use this tool for anything involving comparison, filtering, sums, counts, or ranking across vendors/lines.",
  input_schema: {
    type: "object",
    properties: {
      code: {
        type: "string",
        description:
          "Source of a JS arrow function with signature (rows, vendors) => result. `rows` is an array of {rfxCode, description, ply, boardGsm, print, qty, vendorId, vendorName, unitPriceInr, extendedPriceInr, confidence, notes, sourceQuote} — one entry per (RFx line, vendor) pair. `vendors` is an array of {vendorId, vendorName, questionnaireAnswers (object keyed Q1..Q7), commercialTerms, globalFlags, linesCovered, linesTotal}. Return plain JSON-serializable data (numbers, strings, arrays, objects) — no functions, no classes. Keep the returned payload compact (summarize/aggregate rather than dumping every row) since it will be read by another model, not a human.",
      },
    },
    required: ["code"],
  },
};

function runCompute(code: string, rows: AnalystRow[], vendors: VendorSummary[]): unknown {
  const context = vm.createContext({ console: undefined, Math, JSON });
  const script = new vm.Script(`(${code})`);
  const fn = script.runInContext(context, { timeout: 2000 });
  if (typeof fn !== "function") throw new Error("compute code must evaluate to a function (rows, vendors) => result");
  const result = fn(rows, vendors);
  // guard against enormous payloads blowing up the conversation
  const json = JSON.stringify(result);
  if (json && json.length > 20000) {
    return { truncated: true, note: "Result too large — aggregate more before returning.", preview: json.slice(0, 2000) };
  }
  return result;
}

const SYSTEM = `You are the analyst co-pilot inside a procurement platform. A buyer is looking at a side-by-side comparison of vendor quotes for corrugated packaging and wants to ask questions in plain language instead of clicking through spreadsheets.

You have a "compute" tool that runs real JavaScript over the actual, extracted comparison data. Use it for anything quantitative — do not do arithmetic in your head or guess numbers. You can call it more than once if your first pass needs refining.

Ground rules:
- Rows with confidence "missing" mean the vendor never quoted that line — don't treat them as zero cost, exclude or flag them explicitly.
- Rows with confidence "low" are extracted but uncertain (approximated units, ambiguous mapping, or a stray misread) — when a question is decision-relevant, mention this rather than silently treating a low-confidence number the same as a high-confidence one.
- "Quality questionnaire" style questions require judgment about what "cleared" means — look at the actual questionnaire answers (ISO certification, defect tolerance, claim windows, etc.) in vendors[].questionnaireAnswers, decide a reasonable bar, and SAY what bar you used and why. Don't pretend there's a hardcoded pass/fail flag — there isn't; you're making a defensible judgment call, same as a human analyst would.
- Cite specifics (vendor names, line codes, numbers) in your final answer — the buyer needs to be able to act on this and defend the decision to their own boss.
- Keep the final answer tight: lead with the answer, then the 2-4 numbers/facts that back it up. If a table is the clearest way to show the comparison, include a small markdown table.
- If the data genuinely can't answer the question (missing quotes, unresolved pricing), say so plainly rather than filling the gap with a guess.`;

export async function askAnalyst(
  history: AnalystChatMessage[],
  rfx: Rfx,
  extractions: ExtractionResult[]
): Promise<{ reply: string; toolCalls: { code: string; result: unknown }[] }> {
  const client = getClient();
  const { rows, vendorMeta: vendors } = buildDataset(rfx, extractions);

  const messages: Anthropic.MessageParam[] = history.map((h) => ({ role: h.role, content: h.content }));
  const toolCalls: { code: string; result: unknown }[] = [];

  for (let turn = 0; turn < 6; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: SYSTEM,
      tools: [COMPUTE_TOOL],
      messages,
    });

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");

    if (toolUseBlocks.length === 0) {
      return { reply: textBlocks.map((b) => b.text).join("\n").trim(), toolCalls };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUseBlocks) {
      const input = tu.input as { code: string };
      let resultPayload: unknown;
      try {
        resultPayload = runCompute(input.code, rows, vendors);
      } catch (err) {
        resultPayload = { error: err instanceof Error ? err.message : String(err) };
      }
      toolCalls.push({ code: input.code, result: resultPayload });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(resultPayload),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { reply: "I wasn't able to settle on an answer in a reasonable number of steps — try narrowing the question.", toolCalls };
}
