"use client";

import { useState } from "react";
import type { ExtractionResult, Rfx } from "@/lib/types";
import { normalizeLine, effectiveConfidence } from "@/lib/normalize";
import type { VendorMeta } from "@/lib/types";

const CONF_STYLE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-orange-100 text-orange-800",
  missing: "bg-neutral-200 text-neutral-500",
};

const FILE_ICON: Record<string, string> = {
  xlsx: "📊",
  pdf: "📄",
  docx: "📝",
  image: "📷",
  text: "✉️",
};

export function VendorPanel({
  vendor,
  rfx,
  state,
  onExtract,
}: {
  vendor: VendorMeta;
  rfx: Rfx;
  state: ExtractionResult | "loading" | "error" | undefined;
  onExtract: () => void;
}) {
  const [open, setOpen] = useState(false);

  const normalizedLines =
    state && state !== "loading" && state !== "error" ? state.lines.map((l) => normalizeLine(l, rfx)) : [];
  const covered = normalizedLines.filter((l) => l.normalizedUnitPriceInr !== null).length;

  return (
    <div className="border border-neutral-200 rounded-lg bg-white overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{FILE_ICON[vendor.fileType]}</span>
            <h3 className="font-semibold text-neutral-900 truncate">{vendor.name}</h3>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Replied {new Date(vendor.receivedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·{" "}
            <a href={`/vendor-replies/${vendor.fileName}`} target="_blank" className="underline hover:text-neutral-700">
              view original {vendor.fileType === "image" ? "photo" : "file"}
            </a>
          </p>

          {state && state !== "loading" && state !== "error" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium ${covered === rfx.lineItems.length ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {covered}/{rfx.lineItems.length} lines priced
              </span>
              {state.globalFlags.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
                  {state.globalFlags.length} flag{state.globalFlags.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {(!state || state === "error") && (
            <button
              onClick={onExtract}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-neutral-900 text-white hover:bg-neutral-800"
            >
              {state === "error" ? "Retry extraction" : "Extract"}
            </button>
          )}
          {state === "loading" && (
            <span className="text-xs text-neutral-500 flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
              Reading document…
            </span>
          )}
          {state && state !== "loading" && state !== "error" && (
            <button onClick={() => setOpen((o) => !o)} className="text-xs underline text-neutral-600 hover:text-neutral-900">
              {open ? "Hide detail" : "Show detail"}
            </button>
          )}
        </div>
      </div>

      {open && state && state !== "loading" && state !== "error" && (
        <div className="border-t border-neutral-200 bg-neutral-50 p-4 text-xs space-y-3">
          {state.globalFlags.length > 0 && (
            <div className="space-y-1">
              <p className="font-semibold text-neutral-700">Flags for buyer review</p>
              <ul className="list-disc list-inside space-y-0.5 text-neutral-600">
                {state.globalFlags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="font-semibold text-neutral-700 mb-1">Line-by-line extraction</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-1 pr-2">RFx code</th>
                    <th className="py-1 pr-2">As vendor said it</th>
                    <th className="py-1 pr-2">Rate/box (₹)</th>
                    <th className="py-1 pr-2">Confidence</th>
                    <th className="py-1 pr-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedLines.map((l, i) => (
                    <tr key={i} className="border-t border-neutral-200 align-top">
                      <td className="py-1.5 pr-2 font-mono">{l.rfxCode ?? "—"}</td>
                      <td className="py-1.5 pr-2 text-neutral-600 max-w-[220px]">{l.vendorLabel}</td>
                      <td className="py-1.5 pr-2 font-medium">
                        {l.normalizedUnitPriceInr !== null ? `₹${l.normalizedUnitPriceInr.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${CONF_STYLE[effectiveConfidence(l)]}`}>
                          {effectiveConfidence(l)}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-neutral-500 max-w-[320px]">
                        {[l.notes, l.normalizationNote].filter(Boolean).join(" ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {state.rawModelNotes && (
            <div>
              <p className="font-semibold text-neutral-700">How the model read this document</p>
              <p className="text-neutral-600 italic">{state.rawModelNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
