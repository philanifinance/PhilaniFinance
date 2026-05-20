// Generates the client onboarding / welcome PDF for Philani Financial Services.
// Usage: node scripts/generate-welcome.mjs

import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "design");

const PROVIDER = {
  name: "Ntuthuko Smith",
  tagline: "Web & Software Development",
  email: "ntuthukosmith10@gmail.com",
  phone: "+27 67 711 5581",
  location: "KZN, South Africa",
};

const CLIENT = { name: "Philani Financial Services", contact: "Management" };

const META = { number: `PFS-WELCOME-${new Date().getFullYear()}-001` };

// What I need from you — checklist on page 2
const CHECKLIST = [
  {
    h: "Sign-off on the design deck",
    b: "A short reply confirming you're happy with the design direction shown in the design deck. If anything needs adjusting before go-live, this is the moment to flag it.",
  },
  {
    h: "Supabase project credentials",
    b: "Please share the Supabase project URL and anon key so the platform can be connected to your database. These are found in your Supabase dashboard under Project Settings \u2192 API.",
  },
  {
    h: "Email &amp; SMS provider API keys",
    b: "Resend API key (for transactional email) and BulkSMS token ID &amp; secret (for SMS notifications). Both accounts should be registered in Philani Financial Services\u2019 name.",
  },
  {
    h: "Admin user list",
    b: "A list of staff email addresses that should have admin access to the dashboard — including their role (admin or owner). Owner accounts have access to credit checks and sensitive financial data.",
  },
  {
    h: "Domain DNS access",
    b: "When we go live, I\u2019ll need to add two DNS records (A &amp; CNAME) at your domain registrar to point philanifinance.co.za to the production server. Either grant temporary access, or be ready to apply the records I provide.",
  },
  {
    h: "50% deposit",
    b: "EFT to the banking details on the invoice. Once the deposit clears I lock in your start date and platform configuration begins immediately.",
  },
];

// Timeline — page 3
const TIMELINE = [
  { wk: "Week 1", t: "Kickoff & requirements lock", d: "Design sign-off, credentials collected, admin users confirmed, NCR compliance walkthrough, deposit cleared." },
  { wk: "Week 2", t: "Frontend build & integration", d: "Landing page, application portal, and client dashboard connected to Supabase backend. Email &amp; SMS notifications wired up." },
  { wk: "Week 3", t: "Admin dashboard, contracts & DebiCheck", d: "Admin analytics, loan contract system, e-signature flow, and DebiCheck mandate integration fully configured." },
  { wk: "Week 4", t: "QA, compliance review & launch", d: "Cross-device testing, NCR compliance walkthrough, production hardening, DNS cutover, zero-downtime go-live." },
  { wk: "Days 1\u201330 post-launch", t: "Complimentary support", d: "Bug fixes, minor adjustments, staff training, and performance monitoring \u2014 included at no extra cost." },
];

// How we'll work — page 4
const WAYS = [
  {
    h: "Primary channel",
    b: "Email (<b>ntuthukosmith10@gmail.com</b>) for anything that benefits from a written record. WhatsApp / SMS to <b>+27 67 711 5581</b> for quick questions.",
  },
  {
    h: "Response times",
    b: "Within 24 hours on weekdays, often much sooner. Anything urgent on a weekend \u2014 a quick WhatsApp will reach me.",
  },
  {
    h: "Weekly status updates",
    b: "A short progress note every Friday during the build, plus a live preview link so you can see the platform take shape in real time.",
  },
  {
    h: "Decisions &amp; approvals",
    b: "I\u2019ll batch decisions where I can so you\u2019re never bombarded. When I do need a yes/no, I\u2019ll be specific and won\u2019t move forward until I have your answer.",
  },
];

const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; color: #0f172a; background: white; }
  h1, h2, h3 { font-family: 'Poppins', sans-serif; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
  a { color: inherit; text-decoration: none; }
  .page { width: 210mm; min-height: 297mm; padding: 16mm 18mm 14mm; background: white; position: relative; page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  .brand-strip { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 5mm; border-bottom: 2pt solid #0f172a; margin-bottom: 9mm; }
  .brand-name { font-family: 'Poppins', sans-serif; font-size: 15pt; font-weight: 800; line-height: 1; letter-spacing: -0.03em; color: #0f172a; }
  .brand-name span { color: #22c55e; }
  .brand-sub { font-size: 7pt; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(15,23,42,0.5); margin-top: 1.5mm; }
  .page-num { font-size: 7.5pt; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(15,23,42,0.45); }

  .cover { padding: 0; min-height: 297mm; background: #0f172a; display: flex; flex-direction: column; }
  .cover-inner { padding: 22mm 18mm; display: flex; flex-direction: column; flex: 1; }
  .cover .top-meta { display: flex; justify-content: space-between; align-items: flex-start; font-size: 8pt; color: rgba(255,255,255,0.3); letter-spacing: 0.22em; text-transform: uppercase; }
  .cover .brand-name { color: white; font-size: 16pt; }
  .cover .center { margin-top: auto; margin-bottom: auto; max-width: 165mm; }
  .cover .kicker { font-size: 8pt; letter-spacing: 0.35em; text-transform: uppercase; color: #22c55e; margin-bottom: 8mm; font-weight: 700; }
  .cover h1 { font-size: 38pt; line-height: 1.08; color: white; }
  .cover .sub { font-size: 12pt; font-weight: 300; color: rgba(255,255,255,0.62); line-height: 1.65; margin-top: 9mm; }
  .cover .sub b { color: white; font-weight: 600; }
  .cover .signoff { margin-top: 12mm; padding: 6mm 7mm; background: rgba(255,255,255,0.06); border-left: 2.5pt solid #22c55e; border-radius: 0 4pt 4pt 0; font-size: 9.5pt; line-height: 1.65; color: rgba(255,255,255,0.82); max-width: 155mm; }
  .cover .signoff b { color: white; font-weight: 700; }
  .cover .signature-block { margin-top: 12mm; }
  .cover .signature-block .by { font-family: 'Poppins', sans-serif; font-size: 13pt; font-weight: 700; color: white; }
  .cover .signature-block .role { font-size: 8pt; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-top: 1.5mm; }
  .cover .footer-meta { margin-top: auto; padding-top: 12mm; border-top: 1px solid rgba(255,255,255,0.12); display: flex; justify-content: space-between; font-size: 8pt; color: rgba(255,255,255,0.35); }

  .section-kicker { font-size: 8pt; letter-spacing: 0.3em; text-transform: uppercase; color: #22c55e; margin-bottom: 4mm; font-weight: 700; }
  .section-title { font-size: 22pt; color: #0f172a; line-height: 1.1; margin-bottom: 5mm; max-width: 165mm; }
  .section-lead { font-size: 10pt; color: rgba(15,23,42,0.72); line-height: 1.65; max-width: 170mm; font-weight: 400; margin-bottom: 9mm; }

  .checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .check-card { padding: 5mm 6mm 5mm 12mm; background: #f8fafc; border: 1px solid rgba(15,23,42,0.1); border-radius: 4pt; position: relative; }
  .check-card::before { content: ""; position: absolute; left: 5mm; top: 6.5mm; width: 3.5mm; height: 3.5mm; border: 2pt solid #22c55e; border-radius: 50%; }
  .check-card .h { font-family: 'Poppins', sans-serif; font-size: 10pt; font-weight: 700; color: #0f172a; margin-bottom: 2mm; line-height: 1.25; }
  .check-card .b { font-size: 8.5pt; line-height: 1.55; color: rgba(15,23,42,0.72); }

  .timeline { margin-top: 2mm; margin-bottom: 9mm; }
  .time-row { display: grid; grid-template-columns: 42mm 1fr; gap: 5mm; padding: 4mm 0; border-bottom: 1px dashed rgba(15,23,42,0.15); align-items: flex-start; }
  .time-row:first-child { border-top: 1px dashed rgba(15,23,42,0.15); }
  .time-row .wk { font-family: 'Poppins', sans-serif; font-size: 10pt; font-weight: 700; color: #22c55e; }
  .time-row .t { font-size: 10pt; font-weight: 700; color: #0f172a; margin-bottom: 1mm; font-family: 'Poppins', sans-serif; }
  .time-row .d { font-size: 8.5pt; line-height: 1.55; color: rgba(15,23,42,0.72); }

  .ways { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
  .way { padding: 5mm 6mm; background: #f8fafc; border-radius: 4pt; border-left: 2.5pt solid #22c55e; }
  .way .h { font-size: 7.5pt; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(15,23,42,0.55); margin-bottom: 2mm; font-weight: 700; }
  .way .b { font-size: 9pt; line-height: 1.6; color: rgba(15,23,42,0.82); }
  .way .b b { color: #0f172a; font-weight: 700; }

  .close { margin-top: 10mm; padding: 7mm 8mm; background: #0f172a; color: white; border-radius: 6pt; }
  .close h3 { font-family: 'Poppins', sans-serif; font-size: 15pt; font-weight: 800; margin-bottom: 3mm; }
  .close p { font-size: 9.5pt; line-height: 1.65; color: rgba(255,255,255,0.75); margin: 0 0 3mm; }
  .close .signature { margin-top: 5mm; padding-top: 4mm; border-top: 1px solid rgba(255,255,255,0.15); font-size: 8pt; color: rgba(255,255,255,0.45); letter-spacing: 0.12em; text-transform: uppercase; }
</style></head>
<body>

  <!-- PAGE 1 · WELCOME COVER -->
  <section class="page cover">
    <div class="cover-inner">
      <div class="top-meta">
        <div class="brand-name">Philani <span>Finance</span></div>
        <div>Onboarding &middot; Project Kickoff</div>
      </div>
      <div class="center">
        <div class="kicker">Welcome to the project</div>
        <h1>Welcome, ${CLIENT.contact} &mdash; the platform is ready.</h1>
        <p class="sub">This document is everything you need to get the platform live: <b>what we&apos;ve built</b>, <b>what I need from you</b> in the first few days, and <b>how the next four weeks will run</b>. No surprises &mdash; just a clear path from here to launch.</p>
        <div class="signoff">
          <b>What you&apos;re getting:</b> a complete, NCA/NCR-compliant digital micro-lending platform &mdash; public landing page with loan calculator, multi-step application form, client self-service portal, admin analytics dashboard, automated email &amp; SMS notifications, loan contract system, and DebiCheck integration. Built on React 18, TypeScript, Tailwind CSS, and Supabase. NCR Reg: <b>NCRCP18260</b>.
        </div>
        <div class="signature-block">
          <div class="by">${PROVIDER.name}</div>
          <div class="role">${PROVIDER.tagline}</div>
        </div>
      </div>
      <div class="footer-meta">
        <div>${PROVIDER.email}</div>
        <div>${PROVIDER.phone}</div>
      </div>
    </div>
  </section>

  <!-- PAGE 2 · CHECKLIST -->
  <section class="page">
    <div class="brand-strip">
      <div><div class="brand-name">Philani <span>Finance</span></div><div class="brand-sub">Welcome &middot; Your checklist</div></div>
      <div class="page-num">02 &middot; What I need from you</div>
    </div>
    <div class="section-kicker">Six things to send back to me</div>
    <h2 class="section-title">A short checklist to unlock go-live.</h2>
    <p class="section-lead">The first two items unlock Week 1 kickoff. The rest can land within the first week. Send everything to <b>${PROVIDER.email}</b> or WhatsApp me on <b>${PROVIDER.phone}</b> &mdash; whichever is easier.</p>
    <div class="checklist">
      ${CHECKLIST.map((c) => `
        <div class="check-card">
          <div class="h">${c.h}</div>
          <div class="b">${c.b}</div>
        </div>
      `).join("")}
    </div>
  </section>

  <!-- PAGE 3 · TIMELINE -->
  <section class="page">
    <div class="brand-strip">
      <div><div class="brand-name">Philani <span>Finance</span></div><div class="brand-sub">Welcome &middot; Road to launch</div></div>
      <div class="page-num">03 &middot; Timeline</div>
    </div>
    <div class="section-kicker">The four weeks ahead</div>
    <h2 class="section-title">Four weeks. Zero downtime.</h2>
    <p class="section-lead">Week one is shared &mdash; kickoff and credentials. Weeks two through four are mine. By the end of week four, the Philani Financial Services platform is live on your domain with no disruption to your existing operations.</p>
    <div class="timeline">
      ${TIMELINE.map((t) => `
        <div class="time-row">
          <div class="wk">${t.wk}</div>
          <div>
            <div class="t">${t.t}</div>
            <div class="d">${t.d}</div>
          </div>
        </div>
      `).join("")}
    </div>
  </section>

  <!-- PAGE 4 · WAYS OF WORKING + CLOSE -->
  <section class="page">
    <div class="brand-strip">
      <div><div class="brand-name">Philani <span>Finance</span></div><div class="brand-sub">Welcome &middot; Working together</div></div>
      <div class="page-num">04 &middot; Ways of working</div>
    </div>
    <div class="section-kicker">How we&apos;ll stay in touch</div>
    <h2 class="section-title">Working together.</h2>
    <p class="section-lead">A few simple ground rules so the project runs smoothly and you always know where things stand. Nothing rigid &mdash; just clear expectations on both sides.</p>
    <div class="ways">
      ${WAYS.map((w) => `
        <div class="way">
          <div class="h">${w.h}</div>
          <div class="b">${w.b}</div>
        </div>
      `).join("")}
    </div>
    <div class="close">
      <h3>That&apos;s it &mdash; we&apos;re under way.</h3>
      <p>Reply with sign-off and the deposit, and the clock starts on Week 1. If anything in this document needs adjusting before we begin, just say the word.</p>
      <p style="color:rgba(255,255,255,0.6); margin-top: 4mm; font-style: italic;">Looking forward to launching a platform Philani Financial Services deserves.</p>
      <div class="signature">${PROVIDER.name} &middot; ${PROVIDER.email} &middot; ${PROVIDER.phone}</div>
    </div>
  </section>

</body></html>`;

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const htmlFile = path.join(OUT_DIR, "welcome.html");
  await fs.writeFile(htmlFile, html, "utf8");
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto("file:///" + htmlFile.replaceAll("\\", "/"), { waitUntil: "networkidle0" });
  const heights = await page.evaluate(() => Array.from(document.querySelectorAll(".page")).map((el, i) => `p${i + 1}: ${(el.getBoundingClientRect().height / 96 * 25.4).toFixed(1)}mm`));
  console.log("  Section heights:", heights.join(" · "));
  const pdfPath = path.join(OUT_DIR, "Philani-Finance_Welcome.pdf");
  await page.pdf({ path: pdfPath, format: "A4", printBackground: true, preferCSSPageSize: true });
  await browser.close();
  const stat = await fs.stat(pdfPath);
  const buf = await fs.readFile(pdfPath);
  const pageCount = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`\n✓ Welcome ready: ${pdfPath}`);
  console.log(`  Pages: ${pageCount}  ·  Size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
