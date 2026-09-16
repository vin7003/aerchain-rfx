// Vendor 2 — Apex Corrugators LLP
// Messiness: a clean-looking letterhead PDF table with an across-the-board
// discount buried in a footnote below the table, not applied in the printed
// unit prices themselves.
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const rfx = require("../src/data/rfx-seed.json");
const gt = require("../src/data/_ground-truth.json");

const vendor = gt.vendors.find((v) => v.id === "V2");
const priceByCode = Object.fromEntries(vendor.lines.map((l) => [l.code, l.priceInr]));

const outPath = path.join(__dirname, "../public/vendor-replies/V2-apex-corrugators-quote.pdf");
const doc = new PDFDocument({ margin: 40, size: "A4" });
doc.pipe(fs.createWriteStream(outPath));

doc.fontSize(18).fillColor("#1a3c5e").text("APEX CORRUGATORS LLP", { align: "left" });
doc.fontSize(9).fillColor("#555").text("Plot 14, MIDC Industrial Area, Taloja, Navi Mumbai 410208  |  GSTIN 27AAACA9988L1ZQ  |  sales@apexcorrugators.in");
doc.moveDown(0.8);
doc.fontSize(12).fillColor("#000").text("Quotation — RFX-2026-0142 (Northwind Distribution, Corrugated Cartons FY27)", { underline: true });
doc.fontSize(9).fillColor("#333").text("Quote No: APX/2026/0871   Date: 18-Sep-2026   Valid: 30 days from date above");
doc.moveDown(0.6);

const tableTop = doc.y;
const colX = [40, 75, 340, 400, 460, 520];
const headers = ["#", "Description", "Qty", "Unit", "Rate (INR)"];
doc.fontSize(9).font("Helvetica-Bold");
headers.forEach((h, i) => doc.text(h, colX[i], tableTop, { width: (colX[i + 1] || 560) - colX[i] }));
doc.moveTo(40, tableTop + 14).lineTo(560, tableTop + 14).strokeColor("#999").stroke();

let y = tableTop + 20;
doc.font("Helvetica").fontSize(8.5);
rfx.lineItems.forEach((li, idx) => {
  if (y > 760) {
    doc.addPage();
    y = 50;
  }
  const desc = `${li.description}, ${li.dimensionsMm} mm, ${li.ply}-ply/${li.boardGsm}GSM${li.print !== "Plain" ? ", " + li.print : ""} [${li.code}]`;
  doc.text(String(idx + 1), colX[0], y, { width: colX[1] - colX[0] });
  doc.text(desc, colX[1], y, { width: colX[2] - colX[1] - 6 });
  doc.text(String(li.qty), colX[2], y, { width: colX[3] - colX[2] });
  doc.text("Pc", colX[3], y, { width: colX[4] - colX[3] });
  doc.text(priceByCode[li.code].toFixed(2), colX[4], y, { width: 60 });
  y += 16;
});

y += 10;
doc.moveTo(40, y).lineTo(560, y).strokeColor("#999").stroke();
y += 10;
doc.font("Helvetica").fontSize(8.5).fillColor("#000");
doc.text("Payment terms: 50% advance, balance against delivery. Delivery: 3 weeks ex-works, transport extra.", 40, y, { width: 520 });
y += 24;
doc.font("Helvetica-Oblique").fontSize(8).fillColor("#444");
doc.text(
  "* Season opening offer: an additional 4% discount applies to all line items above, for orders placed and confirmed on or before 15-Oct-2026. Discount will be adjusted at the time of invoicing and does not appear in the unit rates printed above.",
  40, y, { width: 520 }
);

y += 40;
doc.font("Helvetica-Bold").fontSize(9).fillColor("#000").text("Responses to your vendor questionnaire:", 40, y);
y += 14;
doc.font("Helvetica").fontSize(8.5).fillColor("#222");
const qa = [
  "Q1 - ISO 9001:2015: Yes, certified since 2021, copy available on request.",
  "Q2 - FSC board: Yes, FSC-mix board available, no premium for this order size.",
  "Q3 - Standard lead time: 3 weeks (15 working days) as noted above.",
  "Q4 - Rush orders: Yes, within 7 days for up to 30% of order value, 10% premium applies.",
  "Q5 - Quality claims: 10-day claim window, 2% defect tolerance, credit note or replacement buyer's choice.",
  "Q6 - Payment terms: 50% advance / 50% on delivery as noted above; can discuss Net 30 for repeat orders.",
  "Q7 - MOQ: 1,500 pcs per SKU.",
];
qa.forEach((line) => {
  doc.text(line, 40, y, { width: 520 });
  y += 13;
});

doc.end();
doc.on("finish", () => console.log("Wrote", outPath));
