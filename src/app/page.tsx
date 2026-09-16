"use client";

import { useState } from "react";
import rfxSeedRaw from "@/data/rfx-seed.json";
import { VENDORS } from "@/data/vendors";
import type { Rfx, ExtractionResult } from "@/lib/types";
import { ChatPanel, type ChatBubble } from "@/components/ChatPanel";
import { VendorPanel } from "@/components/VendorPanel";
import { ComparisonGrid } from "@/components/ComparisonGrid";

const rfx = rfxSeedRaw as unknown as Rfx;

type Tab = "rfx" | "draft" | "vendors" | "comparison" | "analyst";

const TABS: { id: Tab; label: string }[] = [
  { id: "rfx", label: "1 · The RFx" },
  { id: "draft", label: "2 · Draft with co-pilot" },
  { id: "vendors", label: "3 · Vendor responses" },
  { id: "comparison", label: "4 · Comparison" },
  { id: "analyst", label: "5 · Ask the data" },
];

const ANALYST_SUGGESTIONS = [
  "If we split the award, cheapest per line, but only among vendors who cleared the quality questionnaire, who wins and what's the total?",
  "Which lines have the least trustworthy pricing right now, and why?",
  "How much would we save vs. single-sourcing everything to the cheapest overall vendor?",
  "Which vendor is most complete and reliable across all 30 lines?",
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("rfx");

  // --- RFx co-pilot state ---
  const [copilotMessages, setCopilotMessages] = useState<ChatBubble[]>([]);
  const [copilotDraft, setCopilotDraft] = useState<Partial<Rfx> | null>(null);
  const [copilotBusy, setCopilotBusy] = useState(false);

  async function sendCopilot(text: string) {
    const nextHistory = [...copilotMessages.map(({ role, content }) => ({ role, content })), { role: "user" as const, content: text }];
    setCopilotMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "", pending: true }]);
    setCopilotBusy(true);
    try {
      const res = await fetch("/api/rfx/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: nextHistory }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCopilotMessages((m) => [...m.slice(0, -1), { role: "assistant", content: data.reply || "(drafted — see panel)" }]);
      if (data.draft) setCopilotDraft(data.draft);
    } catch (e) {
      setCopilotMessages((m) => [...m.slice(0, -1), { role: "assistant", content: `Error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setCopilotBusy(false);
    }
  }

  // --- Extraction state ---
  const [extractions, setExtractions] = useState<Record<string, ExtractionResult | "loading" | "error" | undefined>>({});

  async function runExtraction(vendorId: string) {
    setExtractions((s) => ({ ...s, [vendorId]: "loading" }));
    try {
      const res = await fetch(`/api/vendors/${vendorId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfx }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setExtractions((s) => ({ ...s, [vendorId]: data }));
    } catch {
      setExtractions((s) => ({ ...s, [vendorId]: "error" }));
    }
  }

  const anyLoading = Object.values(extractions).some((v) => v === "loading");
  function runAll() {
    VENDORS.forEach((v) => {
      const state = extractions[v.id];
      if (!state || state === "error") runExtraction(v.id);
    });
  }

  // --- Analyst state ---
  const [analystMessages, setAnalystMessages] = useState<ChatBubble[]>([]);
  const [analystBusy, setAnalystBusy] = useState(false);
  const readyExtractions = Object.values(extractions).filter(
    (e): e is ExtractionResult => !!e && e !== "loading" && e !== "error"
  );

  async function sendAnalyst(text: string) {
    if (readyExtractions.length === 0) {
      setAnalystMessages((m) => [
        ...m,
        { role: "user", content: text },
        { role: "assistant", content: "No vendor responses have been extracted yet — head to **3 · Vendor responses** and run extraction first." },
      ]);
      return;
    }
    const nextHistory = [...analystMessages.map(({ role, content }) => ({ role, content })), { role: "user" as const, content: text }];
    setAnalystMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "", pending: true }]);
    setAnalystBusy(true);
    try {
      const res = await fetch("/api/analyst/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: nextHistory, rfx, extractions: readyExtractions }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalystMessages((m) => [...m.slice(0, -1), { role: "assistant", content: data.reply }]);
    } catch (e) {
      setAnalystMessages((m) => [...m.slice(0, -1), { role: "assistant", content: `Error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setAnalystBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="font-semibold text-neutral-900">Kill the Quote Spreadsheet</h1>
          <p className="text-xs text-neutral-500">
            {rfx.buyerCompany} · {rfx.title} · <span className="font-mono">{rfx.id}</span>
          </p>
        </div>
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                tab === t.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 min-h-0">
        {tab === "rfx" && (
          <div className="max-w-4xl mx-auto p-8 overflow-y-auto h-full space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-2">Background</h2>
              <p className="text-neutral-800 text-sm leading-relaxed">{rfx.background}</p>
            </section>
            <section className="grid grid-cols-2 gap-4 text-sm">
              <Fact label="Currency" value={rfx.currency} />
              <Fact label="Delivery" value={rfx.deliveryTerms} />
              <Fact label="Payment requested" value={rfx.paymentTermsRequested} />
              <Fact label="Quote validity" value={`${rfx.quoteValidityRequiredDays} days`} />
            </section>
            <section>
              <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                Line items ({rfx.lineItems.length})
              </h2>
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-100 text-neutral-500">
                    <tr>
                      <th className="text-left p-2">Code</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-left p-2">Size (mm)</th>
                      <th className="text-left p-2">Ply/GSM</th>
                      <th className="text-left p-2">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfx.lineItems.map((li) => (
                      <tr key={li.code} className="border-t border-neutral-100">
                        <td className="p-2 font-mono text-neutral-400">{li.code}</td>
                        <td className="p-2">{li.description}</td>
                        <td className="p-2 text-neutral-500">{li.dimensionsMm}</td>
                        <td className="p-2 text-neutral-500">{li.ply}P / {li.boardGsm}gsm</td>
                        <td className="p-2 text-neutral-500">{li.qty.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-2">Vendor questionnaire</h2>
              <ol className="list-decimal list-inside text-sm text-neutral-700 space-y-1">
                {rfx.questionnaire.map((q) => (
                  <li key={q.id}>{q.question}</li>
                ))}
              </ol>
            </section>
          </div>
        )}

        {tab === "draft" && (
          <div className="grid grid-cols-2 h-full min-h-0">
            <div className="border-r border-neutral-200 min-h-0">
              <ChatPanel
                messages={copilotMessages}
                onSend={sendCopilot}
                busy={copilotBusy}
                placeholder="Describe what you need to source…"
                suggestions={[
                  "I need an annual rate contract for corrugated shipping cartons across our Bhiwandi warehouse — about 30 SKUs, small mailers to bulk pallet cartons, some plain some printed.",
                  "We need 20,000 units of injection-molded plastic pallets, various sizes, for our Pune plant.",
                ]}
                emptyState={
                  <div className="text-sm text-neutral-500 max-w-sm">
                    This is the co-pilot a buyer uses to talk an RFx into existence — describe a sourcing need in
                    plain language and it will draft line items, a questionnaire, and terms. (The vendor responses in
                    the rest of this demo are pre-loaded against the RFX-2026-0142 scenario shown in tab 1, so they
                    won&apos;t change if you draft something new here — this tab is to show the drafting flow itself.)
                  </div>
                }
              />
            </div>
            <div className="p-6 overflow-y-auto min-h-0">
              <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Live draft</h2>
              {!copilotDraft && <p className="text-sm text-neutral-400">Nothing drafted yet — start the conversation.</p>}
              {copilotDraft && (
                <div className="space-y-4 text-sm">
                  {copilotDraft.title && <div className="font-semibold text-neutral-900">{copilotDraft.title}</div>}
                  {copilotDraft.background && <p className="text-neutral-700">{copilotDraft.background}</p>}
                  {copilotDraft.lineItems && copilotDraft.lineItems.length > 0 && (
                    <div>
                      <p className="font-medium text-neutral-700 mb-1">{copilotDraft.lineItems.length} line items</p>
                      <div className="border border-neutral-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <tbody>
                            {copilotDraft.lineItems.map((li, i) => (
                              <tr key={i} className="border-t border-neutral-100 first:border-t-0">
                                <td className="p-1.5 font-mono text-neutral-400">{li.code}</td>
                                <td className="p-1.5">{li.description}</td>
                                <td className="p-1.5 text-neutral-500">{li.qty?.toLocaleString?.("en-IN")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {copilotDraft.questionnaire && copilotDraft.questionnaire.length > 0 && (
                    <div>
                      <p className="font-medium text-neutral-700 mb-1">Questionnaire</p>
                      <ul className="list-disc list-inside text-neutral-600 space-y-0.5">
                        {copilotDraft.questionnaire.map((q) => (
                          <li key={q.id}>{q.question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "vendors" && (
          <div className="max-w-4xl mx-auto p-6 overflow-y-auto h-full">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-neutral-500">
                5 vendors replied over 9 days, each in their own format. Extraction is a real model call per document —
                nothing here is pre-computed.
              </p>
              <button
                onClick={runAll}
                disabled={anyLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-40 flex-shrink-0 ml-4"
              >
                {anyLoading ? "Extracting…" : "Extract all 5"}
              </button>
            </div>
            <div className="space-y-3">
              {VENDORS.map((v) => (
                <VendorPanel key={v.id} vendor={v} rfx={rfx} state={extractions[v.id]} onExtract={() => runExtraction(v.id)} />
              ))}
            </div>
          </div>
        )}

        {tab === "comparison" && (
          <div className="h-full min-h-0">
            <ComparisonGrid rfx={rfx} extractions={extractions} />
          </div>
        )}

        {tab === "analyst" && (
          <div className="max-w-3xl mx-auto h-full min-h-0">
            <ChatPanel
              messages={analystMessages}
              onSend={sendAnalyst}
              busy={analystBusy}
              placeholder="Ask about the comparison…"
              suggestions={ANALYST_SUGGESTIONS}
              emptyState={
                <div className="text-sm text-neutral-500 max-w-md">
                  Once vendor responses are extracted, ask anything about the comparison in plain language — the
                  model writes and runs real code over the extracted data to answer, it doesn&apos;t guess. Try one of
                  the suggestions below, including the exact question from the brief.
                </div>
              }
            />
          </div>
        )}
      </main>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-neutral-400 text-xs">{label}</div>
      <div className="text-neutral-800">{value}</div>
    </div>
  );
}
