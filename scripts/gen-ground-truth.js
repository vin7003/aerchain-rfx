// Internal generation script only — NOT imported by the running app.
// Produces a deterministic "true" pricing sheet used to author the 5 fabricated
// vendor reply documents. The app never reads this file; it only ever sees the
// documents below, and extracts them for real via Claude.
const fs = require("fs");
const path = require("path");
const rfx = require("../src/data/rfx-seed.json");

// deterministic seeded PRNG (mulberry32)
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260908);

function surfaceAreaM2(dimStr) {
  const [l, w, h] = dimStr.split("x").map((s) => parseInt(s.trim(), 10));
  const sa = 2 * (l * w + l * h + w * h); // mm^2
  return sa / 1_000_000; // m^2
}

const printPremium = { Plain: 0, "1-Colour Flexo": 1.8, "2-Colour Flexo": 3.1 };
const fixedCostInr = 3; // die-cutting / handling floor, independent of size
const ratePerM2 = 43; // board + conversion cost per m^2, scaled by GSM below

const trueLines = rfx.lineItems.map((li) => {
  const sa = surfaceAreaM2(li.dimensionsMm);
  const gsmFactor = li.boardGsm / 500;
  const base = fixedCostInr + sa * ratePerM2 * gsmFactor + printPremium[li.print];
  return { code: li.code, basePriceInr: Math.round(base * 100) / 100 };
});

// 5 vendors, each with an overall competitiveness multiplier + per-line noise.
const vendors = [
  { id: "V1", name: "Shree Ganesh Packaging Pvt Ltd", mult: 0.97, noise: 0.03 },
  { id: "V2", name: "Apex Corrugators LLP", mult: 1.02, noise: 0.025 },
  { id: "V3", name: "National Board & Carton Co.", mult: 0.99, noise: 0.035 },
  { id: "V4", name: "Vishal Packaging Works", mult: 0.94, noise: 0.03 },
  { id: "V5", name: "Balaji Corrugated Industries", mult: 1.0, noise: 0.04 },
];

const usdInr = 83.2;

const groundTruth = {
  usdInr,
  vendors: vendors.map((v) => {
    const lines = trueLines.map((tl) => {
      const noise = 1 + (rnd() * 2 - 1) * v.noise;
      const priceInr = Math.round(tl.basePriceInr * v.mult * noise * 100) / 100;
      return { code: tl.code, priceInr };
    });
    return { ...v, lines };
  }),
};

fs.writeFileSync(
  path.join(__dirname, "../src/data/_ground-truth.json"),
  JSON.stringify(groundTruth, null, 2)
);
console.log("Ground truth written for", vendors.length, "vendors,", trueLines.length, "lines.");
