// Vendor 1 — Shree Ganesh Packaging Pvt Ltd
// Messiness: replies with a clean-looking Excel but completely ignores the RFx
// template — own column headers/order, dimensions in cm not mm, rows not in
// PKG-code order, a merged title block, and a GST note buried under the table.
const ExcelJS = require("exceljs");
const path = require("path");
const rfx = require("../src/data/rfx-seed.json");
const gt = require("../src/data/_ground-truth.json");

async function main() {
  const vendor = gt.vendors.find((v) => v.id === "V1");
  const priceByCode = Object.fromEntries(vendor.lines.map((l) => [l.code, l.priceInr]));

  // shuffle row order deterministically (not sorted by PKG code)
  const items = [...rfx.lineItems];
  const order = [
    "PKG-018","PKG-019","PKG-020","PKG-001","PKG-002","PKG-006","PKG-003","PKG-021",
    "PKG-004","PKG-022","PKG-005","PKG-007","PKG-025","PKG-026","PKG-008","PKG-024",
    "PKG-009","PKG-023","PKG-010","PKG-012","PKG-011","PKG-013","PKG-027","PKG-028",
    "PKG-014","PKG-015","PKG-016","PKG-017","PKG-029","PKG-030",
  ];
  const byCode = Object.fromEntries(items.map((i) => [i.code, i]));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Quote");

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = "SHREE GANESH PACKAGING PVT LTD — Quotation for Northwind Distribution (RFX-2026-0142)";
  ws.getCell("A1").font = { bold: true, size: 13 };

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = "GSTIN: 27AACFS1234K1Z9   |   Quote Ref: SGP/QT/0918/26   |   Date: 17-Sep-2026";
  ws.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF666666" } };

  const headerRow = 4;
  const headers = ["S.No", "Item Name", "Box Size (cm, L x B x H)", "Ply / GSM", "Order Qty", "Our Rate (Rs./Pc)"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5233" } };
  });

  order.forEach((code, idx) => {
    const li = byCode[code];
    const [l, w, h] = li.dimensionsMm.split("x").map((s) => parseInt(s.trim(), 10) / 10);
    const row = headerRow + 1 + idx;
    ws.getCell(row, 1).value = idx + 1;
    ws.getCell(row, 2).value = `${li.description}${li.print !== "Plain" ? " (" + li.print + ")" : ""}`;
    ws.getCell(row, 3).value = `${l} x ${w} x ${h}`;
    ws.getCell(row, 4).value = `${li.ply} Ply / ${li.boardGsm} GSM`;
    ws.getCell(row, 5).value = li.qty;
    ws.getCell(row, 6).value = priceByCode[code];
  });

  const noteRow = headerRow + order.length + 2;
  ws.getCell(noteRow, 1).value =
    "Note: Rates above are exclusive of GST (18% extra as applicable). Rates firm for 30 days from quote date. Transport included up to Bhiwandi.";
  ws.mergeCells(noteRow, 1, noteRow, 6);
  ws.getCell(noteRow, 1).font = { italic: true, size: 9 };

  const qRow = noteRow + 2;
  ws.getCell(qRow, 1).value = "Answers to your questionnaire:";
  ws.getCell(qRow, 1).font = { bold: true, size: 10 };
  const answers = [
    "Q1 (ISO 9001): Yes, certified, cert no. IND/QMS/2024/1187, valid till Mar 2027.",
    "Q2 (FSC board): Available on request, adds approx. 4% to board cost.",
    "Q3 (lead time): 12 working days at these volumes.",
    "Q4 (rush orders): Can do 6 days for orders under 5,000 pcs, +15% premium.",
    "Q5 (quality claims): 5-day claim window from delivery, 3% defect tolerance, replacement not refund.",
    "Q6 (payment): Net 30 preferred, can stretch to Net 45 for annual contract.",
    "Q7 (MOQ): 2,000 pcs per SKU.",
  ];
  answers.forEach((a, i) => {
    ws.getCell(qRow + 1 + i, 1).value = a;
    ws.mergeCells(qRow + 1 + i, 1, qRow + 1 + i, 6);
    ws.getCell(qRow + 1 + i, 1).font = { size: 9 };
  });

  ws.columns = [{ width: 7 }, { width: 46 }, { width: 20 }, { width: 16 }, { width: 12 }, { width: 16 }];

  const outPath = path.join(__dirname, "../public/vendor-replies/V1-shree-ganesh-quote.xlsx");
  await wb.xlsx.writeFile(outPath);
  console.log("Wrote", outPath);
}
main();
