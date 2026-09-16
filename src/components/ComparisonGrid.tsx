"use client";

import { Fragment, useState } from "react";
import type { ExtractionResult, Rfx } from "@/lib/types";
import { normalizeLine, effectiveConfidence, type NormalizedLine } from "@/lib/normalize";
import { VENDORS } from "@/data/vendors";

const CONF_DOT: Record<string, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-500",
  low: "bg-orange-500",
  missing: "bg-neutral-300",
};

export function ComparisonGrid({
  rfx,
  extractions,
}: {
  rfx: Rfx;
  extractions: Record<string, ExtractionResult | "loading" | "error" | undefined>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const readyVendors = VENDORS.filter((v) => {
    const e = extractions[v.id];
    return e && e !== "loading" && e !== "error";
  });

  if (readyVendors.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-500 text-sm">
        Run extraction on at least one vendor to build the comparison.
      </div>
    );
  }

  const grid: Record<string, Record<string, NormalizedLine>> = {};
  for (const v of readyVendors) {
    const e = extractions[v.id] as ExtractionResult;
    for (const li of rfx.lineItems) {
      const raw = e.lines.find((l) => l.rfxCode === li.code);
      if (raw) {
        grid[li.code] = grid[li.code] || {};
        grid[li.code][v.id] = normalizeLine(raw, rfx);
      }
    }
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-white z-10 shadow-sm">
          <tr className="text-left">
            <th className="p-2 border-b border-neutral-200 min-w-[220px]">RFx line item</th>
            <th className="p-2 border-b border-neutral-200 min-w-[70px]">Qty</th>
            {readyVendors.map((v) => (
              <th key={v.id} className="p-2 border-b border-neutral-200 min-w-[110px] font-medium">
                {v.name.split(" ").slice(0, 2).join(" ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rfx.lineItems.map((li) => {
            const row = grid[li.code] || {};
            const prices = readyVendors.map((v) => row[v.id]?.normalizedUnitPriceInr ?? null).filter((p): p is number => p !== null);
            const min = prices.length ? Math.min(...prices) : null;
            const isExpanded = expanded === li.code;
            return (
              <Fragment key={li.code}>
                <tr
                  onClick={() => setExpanded(isExpanded ? null : li.code)}
                  className="border-b border-neutral-100 hover:bg-neutral-50 cursor-pointer"
                >
                  <td className="p-2">
                    <div className="font-mono text-[11px] text-neutral-400">{li.code}</div>
                    <div className="font-medium text-neutral-800">{li.description}</div>
                    <div className="text-[11px] text-neutral-400">
                      {li.dimensionsMm}mm · {li.ply}P/{li.boardGsm}gsm{li.print !== "Plain" ? ` · ${li.print}` : ""}
                    </div>
                  </td>
                  <td className="p-2 text-neutral-600">{li.qty.toLocaleString("en-IN")}</td>
                  {readyVendors.map((v) => {
                    const cell = row[v.id];
                    const conf = cell ? effectiveConfidence(cell) : "missing";
                    const isMin = cell?.normalizedUnitPriceInr !== undefined && cell?.normalizedUnitPriceInr === min && min !== null;
                    return (
                      <td key={v.id} className="p-2">
                        {cell?.normalizedUnitPriceInr !== null && cell?.normalizedUnitPriceInr !== undefined ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${CONF_DOT[conf]}`} />
                            <span className={isMin ? "font-semibold text-emerald-700" : "text-neutral-700"}>
                              ₹{cell.normalizedUnitPriceInr.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {isExpanded && (
                  <tr className="bg-neutral-50">
                    <td colSpan={2 + readyVendors.length} className="p-3">
                      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${readyVendors.length}, minmax(0,1fr))` }}>
                        {readyVendors.map((v) => {
                          const cell = row[v.id];
                          return (
                            <div key={v.id} className="text-[11px] bg-white border border-neutral-200 rounded p-2">
                              <div className="font-semibold text-neutral-700 mb-1">{v.name}</div>
                              {cell ? (
                                <>
                                  <div className="text-neutral-500 mb-1">&ldquo;{cell.vendorLabel}&rdquo;</div>
                                  <div className="text-neutral-600 mb-1">{cell.notes}</div>
                                  {cell.normalizationNote && <div className="text-amber-700 mb-1">{cell.normalizationNote}</div>}
                                  <div className="text-neutral-400 italic">source: &ldquo;{cell.sourceQuote}&rdquo;</div>
                                </>
                              ) : (
                                <div className="text-neutral-400">Not addressed in this vendor&apos;s reply.</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
