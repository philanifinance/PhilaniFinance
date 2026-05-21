// Generates a single-page A4 quotation PDF for the Philani Financial Services digital platform.
// Usage: node scripts/generate-quotation.mjs

import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "design");

// ============================================================
// EDIT THESE TO PERSONALISE (provider details)
// ============================================================
const PROVIDER = {
  name: "Ntuthuko Smith",
  tagline: "Web &amp; Software Development",
  email: "ntuthukosmith10@gmail.com",
  phone: "+27 67 711 5581",
  location: "KZN, South Africa",
};

const CLIENT = {
  name: "Philani Financial Services",
  contact: "Attn: Management",
  address1: "3663 Mtshilibe Street, Ratanda",
  address2: "Heidelberg, 1441",
  email: "info@philanifinance.co.za",
};

const QUOTE = {
  number: `PFS-${new Date().getFullYear()}-001`,
  date: new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }),
  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" }),
};

// Line items — digital lending platform development (total: R6,500)
const ITEMS = [
  {
    title: "UX Design &amp; Brand System",
    detail: "Design system (colour, typography, components), mobile-first wireframes, hi-fi mock-ups, and design deck.",
    qty: 1,
    rate: 700,
  },
  {
    title: "Public Landing Page",
    detail: "Hero with live loan calculator, TrustBar, HowItWorks, FAQ, CtaBanner, Footer — fully responsive.",
    qty: 1,
    rate: 900,
  },
  {
    title: "Multi-Step Loan Application Portal",
    detail: "Personal, employment, banking &amp; document upload steps. SA ID validation, income parsing, real-time NCR fee calc.",
    qty: 1,
    rate: 1400,
  },
  {
    title: "Client Self-Service Dashboard",
    detail: "Application status tracking, document access, signed loan contracts, notification history.",
    qty: 1,
    rate: 800,
  },
  {
    title: "Admin Analytics Dashboard",
    detail: "Pipeline overview, approval rate, active portfolio value, monthly trend charts, full audit trail.",
    qty: 1,
    rate: 1000,
  },
  {
    title: "Loan Contract System",
    detail: "NCA-compliant PDF contract generation, in-browser e-signature, secure document archival.",
    qty: 1,
    rate: 700,
  },
  {
    title: "Email &amp; SMS Notification Engine",
    detail: "Transactional emails via Resend + SMS via BulkSMS at every application lifecycle stage.",
    qty: 1,
    rate: 600,
  },
  {
    title: "DebiCheck Mandate Integration",
    detail: "Admin-initiated DebiCheck flow with bank-specific approval instructions and reminder notifications.",
    qty: 1,
    rate: 400,
  },
  {
    title: "Deployment, DNS &amp; 30-day Support",
    detail: "Production deploy, domain DNS configuration, HTTPS, staff onboarding &amp; 30 days post-launch support.",
    qty: 1,
    rate: 500,
    free: true,
    freeLabel: "Included — no extra charge",
  },
];

// Recurring third-party costs (billed directly to client)
const RECURRING = [
  {
    title: "BulkSMS Credit Bundle",
    detail: "2,950 SMS credits — covers transactional notifications (approvals, reminders, DebiCheck alerts).",
    period: "Per bundle",
    rate: 938.05,
  },
  {
    title: "Domain Registration / Renewal",
    detail: ".co.za domain registration or annual renewal (philanifinance.co.za).",
    period: "Per year",
    rate: 187.00,
  },
];

const SUBTOTAL = ITEMS.reduce((s, i) => s + (i.free ? 0 : i.qty * i.rate), 0);
const TOTAL = SUBTOTAL; // R6,500 — VAT not applicable (small-supplier exempt)

const fmt = (n) => "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Convert integer Rand amount to words (sufficient for amounts up to R999,999)
function inWords(n) {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const triplet = (num) => {
    let s = "";
    if (num >= 100) { s += ones[Math.floor(num / 100)] + " hundred"; num %= 100; if (num) s += " and "; }
    if (num >= 20) { s += tens[Math.floor(num / 10)]; if (num % 10) s += "-" + ones[num % 10]; }
    else if (num > 0) { s += ones[num]; }
    return s;
  };
  if (n === 0) return "zero";
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  let w = "";
  if (thousands) w += triplet(thousands) + " thousand";
  if (thousands && rest) w += " ";
  if (rest) w += triplet(rest);
  return w.replace(/\b\w/g, (c) => c.toUpperCase());
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; color: #0f172a; background: white; }
  h1, h2, h3 { font-family: 'Poppins', sans-serif; font-weight: 800; letter-spacing: -0.02em; }
  .page { width: 210mm; padding: 8mm 13mm 8mm; background: white; }

  .top { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 2mm; border-bottom: 2.5pt solid #0f172a; }
  .brand .name { font-family: 'Poppins', sans-serif; font-size: 15pt; font-weight: 800; color: #0f172a; line-height: 1; letter-spacing: -0.03em; }
  .brand .name span { color: #22c55e; }
  .brand .sub { font-size: 7.5pt; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(15,23,42,0.5); margin-top: 1mm; }
  .meta { text-align: right; font-size: 8pt; line-height: 1.45; color: rgba(15,23,42,0.8); }
  .meta .k { letter-spacing: 0.2em; text-transform: uppercase; font-size: 7pt; color: rgba(15,23,42,0.45); }
  .meta .v { font-weight: 600; }

  .title-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2mm; margin-bottom: 1.5mm; }
  .title-row h1 { font-size: 18pt; color: #0f172a; }
  .title-row .pill { display: inline-block; padding: 1.5mm 4mm; border: 1.5pt solid rgba(15,23,42,0.25); border-radius: 999pt; font-size: 7.5pt; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(15,23,42,0.65); font-family: 'Inter', sans-serif; }

  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 2mm; }
  .party { padding: 3mm 4mm; background: #f8fafc; border-radius: 4pt; border-left: 2.5pt solid #22c55e; }
  .party .label { font-size: 7pt; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(15,23,42,0.48); margin-bottom: 1.5mm; font-weight: 600; }
  .party .name { font-family: 'Poppins', sans-serif; font-size: 10pt; font-weight: 700; color: #0f172a; margin-bottom: 1mm; }
  .party .line { font-size: 8pt; line-height: 1.45; color: rgba(15,23,42,0.78); }

  .blurb { padding: 2mm 4mm; background: #f8fafc; border: 1px solid rgba(15,23,42,0.1); border-radius: 3pt; margin-bottom: 2mm; font-size: 8pt; line-height: 1.45; color: rgba(15,23,42,0.78); }
  .blurb b { color: #0f172a; font-weight: 700; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
  thead th { font-size: 7pt; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(15,23,42,0.5); text-align: left; padding: 1.5mm 2mm; border-bottom: 2pt solid #0f172a; font-weight: 700; }
  thead th.r { text-align: right; }
  tbody td { padding: 0.8mm 2mm; vertical-align: top; border-bottom: 1px solid rgba(15,23,42,0.08); font-size: 8.5pt; }
  tbody td.r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .item-title { font-weight: 700; color: #0f172a; margin-bottom: 0.3mm; font-size: 8pt; font-family: 'Poppins', sans-serif; }
  .item-detail { font-size: 6.5pt; color: rgba(15,23,42,0.65); line-height: 1.3; }
  .strike { text-decoration: line-through; color: rgba(15,23,42,0.35); font-weight: 400; }
  .free-label { font-size: 6.5pt; font-weight: 700; color: #22c55e; margin-top: 0.3mm; line-height: 1.1; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }

  .totals { display: flex; justify-content: flex-end; }
  .totals-box { width: 76mm; }
  .totals-row { display: flex; justify-content: space-between; padding: 1mm 0; font-size: 9pt; }
  .totals-row.sub { border-top: 1px solid rgba(15,23,42,0.12); }
  .totals-row.grand { border-top: 2.5pt solid #0f172a; margin-top: 0.5mm; padding-top: 2mm; font-size: 12pt; font-family: 'Poppins', sans-serif; font-weight: 800; color: #0f172a; }
  .totals-row .v { font-variant-numeric: tabular-nums; }
  .vat-note { font-size: 7.5pt; color: rgba(15,23,42,0.48); text-align: right; margin-top: 1mm; font-style: italic; }
  .in-words { font-size: 8.5pt; color: #22c55e; text-align: right; margin-top: 1.5mm; font-weight: 700; font-family: 'Poppins', sans-serif; }

  .terms { margin-top: 2mm; padding: 2.5mm 4mm; background: #f8fafc; border-radius: 3pt; font-size: 7.5pt; line-height: 1.45; color: rgba(15,23,42,0.78); border-left: 2pt solid #0f172a; }
  .terms b { color: #0f172a; font-weight: 700; }

  .signoff { margin-top: 2.5mm; display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
  .sign { font-size: 8pt; }
  .sign .line { border-bottom: 1px solid rgba(15,23,42,0.3); height: 6mm; }
  .sign .label { letter-spacing: 0.2em; text-transform: uppercase; font-size: 6.5pt; color: rgba(15,23,42,0.5); margin-top: 1.5mm; }

  .foot { margin-top: 2mm; padding-top: 2mm; border-top: 1px solid rgba(15,23,42,0.12); font-size: 6.5pt; color: rgba(15,23,42,0.45); text-align: center; letter-spacing: 0.15em; text-transform: uppercase; }
  .section-heading { font-size: 7pt; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(15,23,42,0.48); font-weight: 700; margin-bottom: 1mm; margin-top: 3mm; padding-bottom: 0.8mm; border-bottom: 1.5pt solid #0f172a; }
  .recurring-note { font-size: 7pt; color: rgba(15,23,42,0.5); margin-top: 1mm; font-style: italic; }
  .page-break { break-before: page; page-break-before: always; }
</style></head>
<body>
  <div class="page">
    <div class="top">
      <div class="brand">
        <div class="name">Philani <span>Finance</span></div>
        <div class="sub">Digital Lending Platform &middot; Quotation</div>
      </div>
      <div class="meta">
        <div class="k">From</div>
        <div class="v">${PROVIDER.name}</div>
        <div>${PROVIDER.email}</div>
        <div>${PROVIDER.phone}</div>
        <div>${PROVIDER.location}</div>
      </div>
    </div>

    <div class="title-row">
      <h1>Quotation</h1>
      <span class="pill">${QUOTE.number}</span>
    </div>

    <div class="parties">
      <div class="party">
        <div class="label">Prepared for</div>
        <div class="name">${CLIENT.name}</div>
        <div class="line">${CLIENT.contact}<br/>${CLIENT.address1}<br/>${CLIENT.address2}<br/>${CLIENT.email}</div>
      </div>
      <div class="party">
        <div class="label">Quote details</div>
        <div class="line">
          <b>Date issued:</b> ${QUOTE.date}<br/>
          <b>Valid until:</b> ${QUOTE.validUntil}<br/>
          <b>Currency:</b> ZAR (South African Rand)<br/>
          <b>Project:</b> Digital micro-lending platform
        </div>
      </div>
    </div>

    <!-- Development Items -->
    <div class="section-heading">Development &amp; Delivery</div>
    <table>
      <thead>
        <tr>
          <th style="width: 60%">Description</th>
          <th class="r" style="width: 8%">Qty</th>
          <th class="r" style="width: 16%">Rate</th>
          <th class="r" style="width: 16%">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${ITEMS.map(it => `
          <tr${it.free ? ' class="free"' : ""}>
            <td>
              <div class="item-title">${it.title}</div>
              <div class="item-detail">${it.detail}</div>
            </td>
            <td class="r">${it.qty}</td>
            <td class="r">${it.free ? `<span class="strike">${fmt(it.rate)}</span>` : fmt(it.rate)}</td>
            <td class="r">${it.free ? `<span class="strike">${fmt(it.qty * it.rate)}</span><div class="free-label">${it.freeLabel}</div>` : fmt(it.qty * it.rate)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals">
      <div class="totals-box">
        <div class="totals-row sub"><span>Subtotal</span><span class="v">${fmt(SUBTOTAL)}</span></div>
        <div class="totals-row"><span>VAT</span><span class="v">Not applicable</span></div>
        <div class="totals-row grand"><span>Total due</span><span class="v">${fmt(TOTAL)}</span></div>
        <div class="in-words">${inWords(TOTAL)} Rand only</div>
        <div class="vat-note">Quoted in ZAR. Supplier not VAT-registered.</div>
      </div>
    </div>

    <!-- Recurring Costs — page 2 -->
    <div class="section-heading page-break">Recurring Third-Party Costs <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:7pt">(billed directly to client — not invoiced through developer)</span></div>
    <table>
      <thead>
        <tr>
          <th style="width: 62%">Service</th>
          <th class="r" style="width: 19%">Billing period</th>
          <th class="r" style="width: 19%">Cost (ZAR)</th>
        </tr>
      </thead>
      <tbody>
        ${RECURRING.map(r => `
          <tr>
            <td>
              <div class="item-title">${r.title}</div>
              <div class="item-detail">${r.detail}</div>
            </td>
            <td class="r">${r.period}</td>
            <td class="r">${fmt(r.rate)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="recurring-note">These costs are payable directly to the respective service providers and are listed here for budgeting purposes only.</div>

    <!-- Terms -->
    <div class="terms">
      <b>Payment:</b> 50% deposit (${fmt(TOTAL / 2)}) on acceptance, 50% balance on go-live sign-off. EFT &mdash; banking details on invoice. &nbsp;|&nbsp; <b>Recurring costs:</b> BulkSMS and domain fees are the client&apos;s direct responsibility — see table above. &nbsp;|&nbsp; <b>Out of scope:</b> Third-party credit bureau integration, FICA biometric verification, and payment gateway processing (available as separate engagements).
    </div>

    <!-- Sign-off -->
    <div class="signoff">
      <div class="sign">
        <div class="line"></div>
        <div class="label">Client signature &amp; date</div>
      </div>
      <div class="sign">
        <div class="line"></div>
        <div class="label">${PROVIDER.name}</div>
      </div>
    </div>

    <div class="foot">Thank you · ${QUOTE.number} · Valid until ${QUOTE.validUntil}</div>
  </div>
</body></html>`;

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const htmlFile = path.join(OUT_DIR, "quotation.html");
  await fs.writeFile(htmlFile, html, "utf8");

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("file:///" + htmlFile.replaceAll("\\", "/"), { waitUntil: "networkidle0" });
  const measured = await page.evaluate(() => {
    const el = document.querySelector(".page");
    return { px: el.getBoundingClientRect().height, mm: el.getBoundingClientRect().height / 96 * 25.4 };
  });
  console.log(`  Rendered page height: ${measured.mm.toFixed(1)} mm (A4 = 297 mm)`);
  const pdfPath = path.join(OUT_DIR, "Philani-Finance_Quotation.pdf");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await browser.close();
  const stat = await fs.stat(pdfPath);
  console.log(`\n✓ Quotation ready: ${pdfPath}`);
  console.log(`  Size: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`  Total: ${fmt(TOTAL)} (${inWords(TOTAL)} Rand)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
