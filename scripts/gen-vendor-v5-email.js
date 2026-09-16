// Vendor 5 — Balaji Corrugated Industries
// Messiness: no table, no attachment — just prose in an email body, using
// per-kg pricing for two categories, "same as last year" for a third
// (unresolvable without data we don't have), per-100-pieces for the mailers,
// and a blanket "+6% over FY26" for everything else (also unresolvable).
const fs = require("fs");
const path = require("path");

const body = `From: Ramesh Iyer <ramesh@balajicorrugated.in>
To: procurement@northwinddist.in
Subject: Re: RFX-2026-0142 — Corrugated Cartons FY27 — our rates

Hi team,

Thanks for sending over the RFx, good to see you consolidating this onto one contract.
Here's where we've landed for FY27, sorry for not using your template, our costing is
easier for us to work out this way:

For the standard 3-ply shipping cartons, we can do Rs. 38/kg. For the 5-ply cartons,
Rs. 42/kg. For the 7-ply heavy duty and export boxes, we'll hold at last year's rate —
nothing's changed on our end for those, so no need to re-quote.

The small mailer boxes (the die-cut ones you buy for the e-commerce lines) work out to
Rs. 610 per 100 pieces, plain. Add Rs. 90 per 100 pieces if you want the 1-colour print
version.

Everything else on your list — the archive boxes and the electronics cartons with the
foam insert slots — add 6% over what we quoted you in the FY26 contract, ply for ply,
same as always.

Freight extra, billed at actuals. Payment same terms as before (we think it was 45 days
but please confirm). Quality claims — same 7-day window as last year, 2% tolerance.
ISO cert is current, can send a copy if needed. Let us know if you need anything on
company letterhead instead of email.

Best,
Ramesh
Balaji Corrugated Industries
Plot 22, Anand Nagar MIDC, Ambernath, Thane 421506
`;

const outPath = path.join(__dirname, "../public/vendor-replies/V5-balaji-corrugated-email.txt");
fs.writeFileSync(outPath, body);
console.log("Wrote", outPath);
