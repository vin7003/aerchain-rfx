// Vendor 3 — National Board & Carton Co.
// Messiness: most lines sit in a table, but the heavy-duty/export cartons are
// priced only in a prose paragraph, not in the table at all.
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, WidthType, BorderStyle,
} = require("docx");
const fs = require("fs");
const path = require("path");
const rfx = require("../src/data/rfx-seed.json");
const gt = require("../src/data/_ground-truth.json");

const vendor = gt.vendors.find((v) => v.id === "V3");
const priceByCode = Object.fromEntries(vendor.lines.map((l) => [l.code, l.priceInr]));

const proseOnlyCodes = ["PKG-014", "PKG-015", "PKG-016", "PKG-017", "PKG-029", "PKG-030"];
const tableItems = rfx.lineItems.filter((li) => !proseOnlyCodes.includes(li.code));
const proseItems = rfx.lineItems.filter((li) => proseOnlyCodes.includes(li.code));

function cell(text, opts = {}) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: !!opts.bold })] })],
    width: { size: opts.width || 2000, type: WidthType.DXA },
  });
}

const headerRow = new TableRow({
  children: ["Code", "Description", "Size (mm)", "Ply/GSM", "Qty", "Rate ₹/box"].map((h) => cell(h, { bold: true })),
});

const rows = tableItems.map(
  (li) =>
    new TableRow({
      children: [
        cell(li.code),
        cell(`${li.description}${li.print !== "Plain" ? " (" + li.print + ")" : ""}`, { width: 4200 }),
        cell(li.dimensionsMm),
        cell(`${li.ply}P/${li.boardGsm}`),
        cell(li.qty),
        cell(priceByCode[li.code].toFixed(2)),
      ],
    })
);

const table = new Table({ rows: [headerRow, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } });

const proseText = proseItems
  .map((li) => `${li.code} (${li.dimensionsMm} mm, ${li.ply}-ply) at Rs. ${priceByCode[li.code].toFixed(2)} per box`)
  .join("; ");

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({ text: "National Board & Carton Co.", heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: "Sonale Village, Bhiwandi-Kalyan Road, Thane 421302 | GSTIN 27AABCN5566P1Z2" }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "Re: Quotation for RFX-2026-0142 — Corrugated Cartons, Northwind Distribution", heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: "Dear Sir/Madam, please find our best rates below for the standard carton range you have listed:" }),
        new Paragraph({ text: "" }),
        table,
        new Paragraph({ text: "" }),
        new Paragraph({
          children: [new TextRun({ text: "Heavy-duty and export cartons: ", bold: true })],
        }),
        new Paragraph({
          text:
            `For the heavier 7-ply cartons and export-grade boxes, our rates work out a little differently given the board thickness involved — we can do the ${proseText}. These are subject to a 15-day lead time given the higher GSM board needs to be ordered specially from our Taloja supplier.`,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          text:
            "Commercial terms: Payment 30% advance with PO, 70% against delivery. Prices valid 21 days. Freight to Bhiwandi included. Prices above are exclusive of GST.",
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "On your questionnaire:", bold: true })] }),
        new Paragraph({
          text:
            "Our ISO 9001 certification is currently in process with the audit body, expected to come through by Q1 2027 — happy to share the application acknowledgment in the meantime. We don't currently stock FSC-certified board but can source it against a specific PO at a cost to be quoted separately. Standard lead time is 18 working days. We can't commit to rush/expedited orders below 15 days given our current line load. On quality, we offer a 3-day claim window from delivery with a 5% defect tolerance — beyond that we'd need photographic evidence for any claim. MOQ is 1,000 pcs per SKU.",
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "Regards,\nRakesh Shetty, Sales Head, National Board & Carton Co." }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const outPath = path.join(__dirname, "../public/vendor-replies/V3-national-board-quote.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("Wrote", outPath);
});
