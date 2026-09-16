import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local (local dev) or your host's environment variables (deployed)."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Sonnet by default: strong at document-messiness reasoning and tool use,
// fast enough for an interactive analyst chat.
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
