import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL } from "./anthropic";
import type { Rfx } from "./types";

const DRAFT_TOOL: Anthropic.Tool = {
  name: "update_rfx_draft",
  description:
    "Propose or update the structured RFx draft based on the conversation so far. Call this whenever you have enough information to draft or meaningfully revise line items, questionnaire, or terms — you don't need every field filled before calling it; partial drafts are fine and expected early in the conversation.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      category: { type: "string" },
      background: { type: "string", description: "1-3 sentences on what this RFx is for." },
      currency: { type: "string" },
      deliveryTerms: { type: "string" },
      paymentTermsRequested: { type: "string" },
      quoteValidityRequiredDays: { type: "number" },
      lineItems: {
        type: "array",
        items: {
          type: "object",
          properties: {
            code: { type: "string" },
            description: { type: "string" },
            dimensionsMm: { type: "string" },
            ply: { type: "number" },
            boardGsm: { type: "number" },
            print: { type: "string" },
            qty: { type: "number" },
            uom: { type: "string" },
          },
          required: ["code", "description", "dimensionsMm", "ply", "boardGsm", "print", "qty", "uom"],
        },
      },
      questionnaire: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, question: { type: "string" } },
          required: ["id", "question"],
        },
      },
      termsRequested: {
        type: "object",
        properties: {
          delivery: { type: "string" },
          payment: { type: "string" },
          quoteValidityDays: { type: "string" },
          sampleApproval: { type: "string" },
          currency: { type: "string" },
        },
      },
    },
    required: ["title", "category", "background", "lineItems", "questionnaire"],
  },
};

const SYSTEM = `You are the RFx drafting co-pilot inside a B2B procurement platform. A category buyer describes, in plain language, what they need to source. Your job is to turn that into a structured RFx: a scope/background note, a clean set of line items (with realistic specs for the category — dimensions, material grade, quantities, whatever is relevant), a short vendor questionnaire (quality/compliance/commercial questions worth asking), and requested commercial terms.

Be a good procurement analyst: ask 1-2 sharp clarifying questions if the buyer's request is too vague to draft responsibly (e.g. missing volumes, destination, category specifics) — but don't interrogate them forever. As soon as you have enough to draft something reasonable, call update_rfx_draft with your best draft, say so in your reply, and invite the buyer to adjust anything. On later turns, revise the draft based on their feedback and call update_rfx_draft again with the FULL updated draft (not a diff).

Keep line item codes short and sequential (e.g. LOT-001, LOT-002...). Keep replies conversational and brief — you're a co-pilot, not a form.`;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function draftRfxTurn(
  history: ChatTurn[]
): Promise<{ reply: string; draft: Partial<Rfx> | null }> {
  const client = getClient();

  const messages: Anthropic.MessageParam[] = history.map((h) => ({
    role: h.role,
    content: h.content,
  }));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [DRAFT_TOOL],
    messages,
  });

  let reply = "";
  let draft: Partial<Rfx> | null = null;
  for (const block of response.content) {
    if (block.type === "text") reply += block.text;
    if (block.type === "tool_use" && block.name === "update_rfx_draft") {
      draft = block.input as Partial<Rfx>;
    }
  }

  return { reply: reply.trim(), draft };
}
