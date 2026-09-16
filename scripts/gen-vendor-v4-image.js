// Vendor 4 — Vishal Packaging Works
// Messiness: a printed rate card photographed at an angle, on a phone.
// Priced in USD (vendor exports and quotes that way out of habit).
// Only 27 of 30 lines quoted — no export-grade cartons (PKG-028/029/030).
const sharp = require("sharp");
const path = require("path");
const rfx = require("../src/data/rfx-seed.json");
const gt = require("../src/data/_ground-truth.json");

const vendor = gt.vendors.find((v) => v.id === "V4");
const priceByCode = Object.fromEntries(vendor.lines.map((l) => [l.code, l.priceInr]));
const skip = ["PKG-028", "PKG-029", "PKG-030"];
const items = rfx.lineItems.filter((li) => !skip.includes(li.code));

const rowH = 34;
const top = 150;
const width = 900;
const height = top + rowH * (items.length + 2) + 60;

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

const printAbbrev = { Plain: "", "1-Colour Flexo": " 1-Col", "2-Colour Flexo": " 2-Col" };

let rows = "";
items.forEach((li, i) => {
  const y = top + 30 + i * rowH;
  const usd = (priceByCode[li.code] / gt.usdInr).toFixed(2);
  const dims = li.dimensionsMm.replace(/\s/g, "");
  const label = `${li.code}   ${dims}mm   ${li.ply}P/${li.boardGsm}gsm${printAbbrev[li.print]}`;
  if (i % 2 === 0) {
    rows += `<rect x="30" y="${y - 18}" width="770" height="${rowH}" fill="#000000" opacity="0.03"/>`;
  }
  rows += `<text x="40" y="${y}" font-family="Courier New, monospace" font-size="14" fill="#111">${esc(label)}</text>`;
  rows += `<text x="780" y="${y}" font-family="Courier New, monospace" font-size="14" fill="#111" text-anchor="end">$${usd}</text>`;
});

const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#faf8f2"/>
  <text x="40" y="45" font-family="Arial" font-size="24" font-weight="bold" fill="#0a0a0a">VISHAL PACKAGING WORKS</text>
  <text x="40" y="70" font-family="Arial" font-size="13" fill="#333">Rate Card — Northwind Distribution RFX-2026-0142 (Rev 17-Sep-2026)</text>
  <text x="40" y="90" font-family="Arial" font-size="12" fill="#555">All rates in USD, FOB Bhiwandi, ex-works. Excludes cartons above 500L capacity (export-grade — quoted separately on request).</text>
  <line x1="40" y1="105" x2="860" y2="105" stroke="#888" stroke-width="1.5"/>
  <text x="40" y="128" font-family="Arial" font-size="13" font-weight="bold" fill="#000">Item</text>
  <text x="820" y="128" font-family="Arial" font-size="13" font-weight="bold" fill="#000" text-anchor="end">Rate/pc</text>
  ${rows}
  <line x1="40" y1="${top + 20 + items.length * rowH}" x2="860" y2="${top + 20 + items.length * rowH}" stroke="#888" stroke-width="1.5"/>
  <text x="40" y="${top + 45 + items.length * rowH}" font-family="Arial" font-size="11" fill="#555">Terms: 40% advance / 60% on delivery. Lead time 18 working days. Rates held 15 days.</text>
  <text x="40" y="${top + 65 + items.length * rowH}" font-family="Arial" font-size="11" fill="#555">Quality: in-house checks, no ISO/FSC certification currently. Claims handled case-by-case, no fixed window.</text>
</svg>`;

async function main() {
  const flat = await sharp(Buffer.from(svg)).png().toBuffer();

  // simulate a phone photo: slight rotation, perspective-ish crop via extend,
  // mild blur, then re-encode as a JPEG with compression artifacts and a
  // slightly warm/uneven tone.
  const rotated = await sharp(flat)
    .rotate(3.4, { background: { r: 235, g: 231, b: 220, alpha: 1 } })
    .modulate({ brightness: 1.03, saturation: 0.92 })
    .blur(0.5)
    .jpeg({ quality: 72 })
    .toBuffer();

  const outPath = path.join(__dirname, "../public/vendor-replies/V4-vishal-packaging-ratecard.jpg");
  require("fs").writeFileSync(outPath, rotated);
  console.log("Wrote", outPath, `(${items.length} of ${rfx.lineItems.length} lines quoted)`);
}
main();
