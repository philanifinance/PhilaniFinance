// Generates a comprehensive design deck PDF for Philani Financial Services.
// Captures every view: landing, how it works, FAQ, apply form, client dashboard,
// admin dashboard (analytics, queue, and application detail).
//
// Prerequisites:
//   1. Dev server running: npm run dev
//   2. Add to your .env file:
//        DEMO_ADMIN_EMAIL=your-admin@email.com
//        DEMO_ADMIN_PASSWORD=yourpassword
//   3. Run: node scripts/generate-design-pdf.mjs

import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "design");
const SHOT_DIR = path.join(OUT_DIR, "shots");
const BASE = "http://localhost:5173";
const SUPABASE_URL = "https://wmpfweskrnliqwkqkpoq.supabase.co";
const STORAGE_KEY = "sb-wmpfweskrnliqwkqkpoq-auth-token";

const DV = { width: 1440, height: 900, deviceScaleFactor: 2 };
const MV = { width: 393,  height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

// ── Env & Auth helpers ────────────────────────────────────────────────

async function loadEnvFiles() {
  for (const file of [".env", ".env.local"]) {
    try {
      const content = await fs.readFile(path.resolve(__dirname, "..", file), "utf8");
      for (const line of content.split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {}
  }
}

async function supabaseSignIn(email, password, anonKey) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": anonKey },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Auth failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function injectSession(page, session) {
  const value = {
    access_token:  session.access_token,
    token_type:    session.token_type || "bearer",
    expires_in:    session.expires_in || 3600,
    expires_at:    Math.floor(Date.now() / 1000) + (session.expires_in || 3600),
    refresh_token: session.refresh_token,
    user:          session.user,
  };
  await page.evaluate((k, v) => localStorage.setItem(k, JSON.stringify(v)), STORAGE_KEY, value);
}

async function appNavigate(page, target, delay = 2000) {
  await page.evaluate((p) => { if (window.__appNavigate) window.__appNavigate(p); }, target);
  await new Promise(r => setTimeout(r, delay));
}

async function clickByText(page, text) {
  await page.evaluate((t) => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent?.trim().includes(t));
    if (btn) btn.click();
  }, text);
}

async function shot(page, name) {
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return `shots/${name}.png`;
}

async function ensureDirs() {
  await fs.mkdir(SHOT_DIR, { recursive: true });
}

// ── Public page capture (desktop + mobile) ────────────────────────────

async function capturePublic(browser) {
  const s = {};
  const page = await browser.newPage();

  const scrollTo = async (id) => {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    }, id);
    await new Promise(r => setTimeout(r, 900));
  };

  const go = async (url) => {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    await new Promise(r => setTimeout(r, 1200));
  };

  console.log("  Landing hero…");
  await page.setViewport(DV);    await go(BASE);
  s.heroD = await shot(page, "hero_desktop");
  await page.setViewport(MV);    await go(BASE);
  s.heroM = await shot(page, "hero_mobile");

  console.log("  How It Works…");
  await page.setViewport(DV);    await go(BASE);
  await scrollTo("#how-it-works");
  s.hiwD = await shot(page, "hiw_desktop");
  await page.setViewport(MV);    await go(BASE);
  await scrollTo("#how-it-works");
  s.hiwM = await shot(page, "hiw_mobile");

  console.log("  FAQ & CTA…");
  await page.setViewport(DV);    await go(BASE);
  await scrollTo("#faq");
  s.faqD = await shot(page, "faq_desktop");
  await page.setViewport(MV);    await go(BASE);
  await scrollTo("#faq");
  s.faqM = await shot(page, "faq_mobile");

  await page.close();
  return s;
}

// ── Authenticated view capture ─────────────────────────────────────────

async function captureAuth(browser, session) {
  const s = {};
  const page = await browser.newPage();
  await page.setViewport({ ...DV, deviceScaleFactor: 1.5 });

  // Inject session and reload
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await injectSession(page, session);
  await page.reload({ waitUntil: "networkidle0" });
  console.log("  Waiting for auth + role fetch…");
  await new Promise(r => setTimeout(r, 4500)); // allow Supabase getSession + profiles query

  // ── Admin: top analytics (dark header + metric cards + pipeline chart) ──
  console.log("  Admin analytics…");
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 400));
  s.adminAnalytics = await shot(page, "admin_analytics");

  // ── Admin: queue table (scroll past the analytics section) ──
  console.log("  Admin queue…");
  await page.evaluate(() => window.scrollTo(0, 680));
  await new Promise(r => setTimeout(r, 400));
  s.adminQueue = await shot(page, "admin_queue");

  // ── Admin: application detail ──
  console.log("  Admin detail…");
  const opened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === "Review");
    if (btn) { btn.click(); return true; }
    const row = document.querySelector("tbody tr");
    if (row) { row.click(); return true; }
    return false;
  });
  if (opened) {
    await new Promise(r => setTimeout(r, 2500));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 400));
    s.adminDetail = await shot(page, "admin_detail");
  } else {
    console.warn("  ⚠ No application rows found — skipping detail view.");
  }

  // ── Application form (navigate home → click Apply Now) ──
  console.log("  Application form…");
  await appNavigate(page, "home", 1500);
  await clickByText(page, "Apply Now");
  await new Promise(r => setTimeout(r, 1500));
  await page.evaluate(() => window.scrollTo(0, 0));
  s.applyForm = await shot(page, "apply_form");

  // ── Client dashboard — Tracker tab ──
  console.log("  Client dashboard (tracker)…");
  await appNavigate(page, "dashboard", 2800);
  await page.evaluate(() => window.scrollTo(0, 0));
  s.dashTracker = await shot(page, "dashboard_tracker");

  // ── Client dashboard — Loan History tab ──
  console.log("  Client dashboard (history)…");
  await clickByText(page, "Loan History");
  await new Promise(r => setTimeout(r, 900));
  s.dashHistory = await shot(page, "dashboard_history");

  // ── Client dashboard — My Profile tab ──
  console.log("  Client dashboard (profile)…");
  await clickByText(page, "My Profile");
  await new Promise(r => setTimeout(r, 900));
  s.dashProfile = await shot(page, "dashboard_profile");

  await page.close();
  return s;
}

function renderHTML(pubSections, authSections) {
  const total = 2 + pubSections.length * 2 + authSections.length;
  let pageIdx = 1; // cover is page 1 (unnumbered); system page starts at 02
  const pn = () => `${String(++pageIdx).padStart(2,"0")} / ${String(total).padStart(2,"0")}`;

  const css = `
    @page { size: A3 landscape; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, sans-serif; color: #0f172a; background: #f8fafc; }
    h1, h2, h3 { font-family: 'Poppins', sans-serif; font-weight: 800; letter-spacing: -0.02em; margin: 0; }
    .page { width: 420mm; height: 297mm; padding: 18mm 22mm; page-break-after: always; position: relative; background: #f8fafc; overflow: hidden; }
    .page:last-child { page-break-after: auto; }
    .page-number { position: absolute; top: 18mm; right: 22mm; font-size: 9pt; letter-spacing: 0.25em; color: rgba(15,23,42,0.38); text-transform: uppercase; font-family: 'Inter', sans-serif; }
    .brand { position: absolute; top: 18mm; left: 22mm; display: flex; flex-direction: column; }
    .brand-name { font-family: 'Poppins', sans-serif; font-size: 14pt; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; line-height: 1; }
    .brand-name span { color: #22c55e; }
    .brand-sub { font-size: 7pt; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(15,23,42,0.45); margin-top: 1.5mm; font-family: 'Inter', sans-serif; }
    /* Cover */
    .cover { background: #0f172a; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 22mm 28mm; }
    .cover .brand { position: static; margin-bottom: 14mm; }
    .cover .brand-name { color: #fff; font-size: 16pt; }
    .cover .tag { font-size: 9pt; letter-spacing: 0.32em; text-transform: uppercase; color: #22c55e; margin-bottom: 8mm; font-family: 'Inter', sans-serif; font-weight: 700; }
    .cover h1 { font-size: 50pt; line-height: 1.06; color: #fff; max-width: 300mm; margin-bottom: 10mm; }
    .cover h1 span { color: #22c55e; }
    .cover .sub { font-size: 12pt; font-weight: 300; color: rgba(255,255,255,0.6); max-width: 220mm; line-height: 1.65; }
    .cover .pill { display: inline-flex; align-items: center; gap: 2mm; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; font-size: 8pt; padding: 1.5mm 4mm; border-radius: 99pt; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; margin-top: 11mm; font-family: 'Inter', sans-serif; }
    .cover .meta { position: absolute; bottom: 18mm; left: 28mm; right: 28mm; display: flex; justify-content: space-between; font-size: 8pt; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.28); font-family: 'Inter', sans-serif; }
    /* Section header */
    .section-header { margin-bottom: 8mm; }
    .section-header .kicker { font-size: 8pt; letter-spacing: 0.3em; text-transform: uppercase; color: #22c55e; margin-bottom: 3mm; font-weight: 700; font-family: 'Inter', sans-serif; }
    .section-header h2 { font-size: 30pt; color: #0f172a; line-height: 1.1; }
    .section-header .desc { font-size: 10pt; color: rgba(15,23,42,0.58); margin-top: 4mm; font-weight: 400; max-width: 200mm; line-height: 1.65; }
    /* Layout */
    .layout { display: grid; grid-template-columns: 1.55fr 1fr; gap: 12mm; align-items: flex-start; margin-top: 4mm; height: calc(100% - 45mm); }
    .frame { background: white; border-radius: 6pt; box-shadow: 0 10pt 36pt -10pt rgba(15,23,42,0.2); overflow: hidden; border: 1px solid rgba(15,23,42,0.07); }
    .frame-header { display: flex; align-items: center; gap: 6pt; padding: 5pt 9pt; background: #0f172a; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 7pt; color: rgba(255,255,255,0.4); }
    .dot { width: 7pt; height: 7pt; border-radius: 50%; display: inline-block; }
    .dot.r { background: #FF6B5B; } .dot.y { background: #FFC24C; } .dot.g { background: #22c55e; }
    .frame-url { margin-left: 8pt; font-family: Menlo, Consolas, monospace; font-size: 7pt; color: rgba(255,255,255,0.38); }
    .frame-body { background: #f8fafc; }
    .desktop-wrap, .mobile-wrap { display: flex; flex-direction: column; height: 100%; }
    .desktop-wrap .caption, .mobile-wrap .caption { font-size: 7pt; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(15,23,42,0.48); margin-bottom: 3mm; font-weight: 600; font-family: 'Inter', sans-serif; }
    .desktop-img { width: 100%; display: block; }
    .desktop-scroll { max-height: 195mm; overflow: hidden; }
    .mobile-frame { width: 78mm; margin: 0 auto; border: 2.5pt solid #0f172a; border-radius: 10pt; padding: 3pt; background: #0f172a; box-shadow: 0 8pt 24pt -6pt rgba(15,23,42,0.45); }
    .mobile-inner { max-height: 175mm; overflow: hidden; border-radius: 7pt; background: #f8fafc; }
    .mobile-img { width: 100%; display: block; }
    .notes { margin-top: 8mm; padding: 6mm 7mm; background: white; border-left: 2.5pt solid #22c55e; font-size: 9.5pt; line-height: 1.6; color: rgba(15,23,42,0.72); border-radius: 0 4pt 4pt 0; }
    .notes b { color: #0f172a; font-weight: 700; }
    .specs { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-top: 8mm; }
    .spec { padding: 5mm 6mm; background: white; border-radius: 4pt; border: 1px solid rgba(15,23,42,0.07); }
    .spec .k { font-size: 7pt; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(15,23,42,0.48); margin-bottom: 2mm; font-weight: 600; }
    .spec .v { font-size: 10.5pt; color: #0f172a; font-weight: 600; font-family: 'Poppins', sans-serif; }
    .palette { display: flex; gap: 8mm; margin-top: 10mm; }
    .swatch { flex: 1; }
    .swatch .chip { width: 100%; height: 36mm; border-radius: 4pt; }
    .swatch .lbl { margin-top: 3mm; font-size: 9pt; font-weight: 600; color: rgba(255,255,255,0.9); }
    .swatch .hex { font-family: Menlo, Consolas, monospace; font-size: 8pt; color: rgba(255,255,255,0.4); margin-top: 1mm; }
    .system-page { background: #0f172a; }
    .system-page .section-header .kicker { color: #22c55e; }
    .system-page .section-header h2 { color: white; }
    .system-page .section-header .desc { color: rgba(255,255,255,0.5); }
    .system-page .spec { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
    .system-page .spec .k { color: rgba(255,255,255,0.4); }
    .system-page .spec .v { color: white; }
    .system-page .brand-name { color: white; }
    .system-page .brand-sub { color: rgba(255,255,255,0.3); }
    .system-page .page-number { color: rgba(255,255,255,0.25); }
    /* Auth single-page layout */
    .auth-layout { display: grid; grid-template-columns: 1.9fr 1fr; gap: 9mm; align-items: flex-start; margin-top: 3mm; height: calc(100% - 48mm); }
    .auth-wrap { display: flex; flex-direction: column; }
    .auth-wrap .caption { font-size: 7pt; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(15,23,42,0.48); margin-bottom: 3mm; font-weight: 600; font-family: 'Inter', sans-serif; }
    .auth-scroll { max-height: 202mm; overflow: hidden; }
    .auth-img { width: 100%; display: block; }
    .auth-panel { display: flex; flex-direction: column; gap: 3.5mm; padding-top: 10mm; }
    .auth-note { padding: 5mm 6mm; background: white; border-radius: 4pt; border: 1px solid rgba(15,23,42,0.07); }
    .auth-note .k { font-size: 7pt; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(15,23,42,0.4); margin-bottom: 1.5mm; font-weight: 700; font-family: 'Inter', sans-serif; }
    .auth-note .v { font-size: 9pt; color: #0f172a; font-weight: 600; font-family: 'Poppins', sans-serif; line-height: 1.45; }
    .auth-blurb { font-size: 8.5pt; color: rgba(15,23,42,0.6); line-height: 1.6; margin-bottom: 4mm; border-left: 2pt solid #22c55e; padding-left: 4mm; }
  `;

  const brand = (sub) => `<div class="brand"><div class="brand-name">Philani <span style="color:#22c55e;">Finance</span></div><div class="brand-sub">${sub}</div></div>`;
  const fh = (url) => `<div class="frame-header"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="frame-url">${url}</span></div>`;

  const cover = `
    <section class="page cover">
      <div class="brand"><div class="brand-name">Philani <span>Finance</span></div></div>
      <p class="tag">Digital Lending Platform &middot; Design Deck</p>
      <h1>Fast, fair credit.<br/><span>Built for South Africa.</span></h1>
      <p class="sub">A complete design presentation for Philani Financial Services &mdash; showcasing the landing page, loan application portal, client dashboard, and admin back-office across desktop and mobile. Built with React 18, TypeScript, Tailwind CSS and Supabase.</p>
      <div class="pill">NCR Reg: NCRCP18260 &middot; NCA &amp; POPIA Compliant</div>
      <div class="meta">
        <span>3663 Mtshilibe Street, Ratanda, Heidelberg, 1441</span>
        <span>013 752 2478 &middot; info@philanifinance.co.za</span>
      </div>
    </section>`;

  const system = `
    <section class="page system-page">
      ${brand("Design System")}
      <div class="page-number">${pn()}</div>
      <div class="section-header" style="margin-top:20mm;">
        <div class="kicker">01 &middot; Foundations</div>
        <h2>The visual language</h2>
        <p class="desc">A premium, trust-first palette anchored in deep navy and brand green — projecting financial authority while remaining approachable. Poppins ExtraBold for display, Inter for crisp body copy and data. Subtle card surfaces, animated counters, and generous whitespace convey confidence.</p>
      </div>
      <div class="palette">
        <div class="swatch"><div class="chip" style="background:#0f172a;"></div><div class="lbl">Navy 950</div><div class="hex">#0f172a</div></div>
        <div class="swatch"><div class="chip" style="background:#1e3a5f;"></div><div class="lbl">Navy 700</div><div class="hex">#1e3a5f</div></div>
        <div class="swatch"><div class="chip" style="background:#22c55e;"></div><div class="lbl">Brand Green</div><div class="hex">#22c55e</div></div>
        <div class="swatch"><div class="chip" style="background:#f8fafc;border:1px solid rgba(255,255,255,0.15);"></div><div class="lbl">Slate 50</div><div class="hex">#f8fafc</div></div>
        <div class="swatch"><div class="chip" style="background:#fff;border:1px solid rgba(255,255,255,0.15);"></div><div class="lbl">White</div><div class="hex">#ffffff</div></div>
      </div>
      <div class="specs" style="margin-top:8mm;">
        <div class="spec"><div class="k">Display Font</div><div class="v" style="font-family:'Poppins',sans-serif;font-weight:800;">Poppins &middot; ExtraBold 800</div></div>
        <div class="spec"><div class="k">Body Font</div><div class="v">Inter &middot; 300 / 400 / 500 / 600</div></div>
        <div class="spec"><div class="k">Backend</div><div class="v">Supabase &middot; PostgreSQL &middot; Edge Functions</div></div>
        <div class="spec"><div class="k">Tech Stack</div><div class="v">React 18 &middot; TypeScript &middot; Tailwind &middot; Vite</div></div>
      </div>
    </section>`;

  // Public sections — desktop + mobile split, plus a notes page
  const pubPages = pubSections.map((s, i) => {
    const kicker = `0${i + 2} &middot; ${s.label}`;
    return `
    <section class="page">
      ${brand(s.label)}
      <div class="page-number">${pn()}</div>
      <div class="section-header" style="margin-top:20mm;">
        <div class="kicker">${kicker}</div>
        <h2>${s.heading}</h2>
        <p class="desc">${s.desc}</p>
      </div>
      <div class="layout">
        <div class="desktop-wrap">
          <div class="caption">Desktop &middot; 1440 &times; 900</div>
          <div class="frame">${fh("philanifinance.co.za")}
            <div class="frame-body desktop-scroll"><img class="desktop-img" src="${s.desktopShot}"/></div>
          </div>
        </div>
        <div class="mobile-wrap">
          <div class="caption">Mobile &middot; 393 &times; 852</div>
          <div class="mobile-frame"><div class="mobile-inner"><img class="mobile-img" src="${s.mobileShot}"/></div></div>
        </div>
      </div>
    </section>
    <section class="page">
      ${brand(s.label + " &middot; Notes")}
      <div class="page-number">${pn()}</div>
      <div class="section-header" style="margin-top:20mm;"><div class="kicker">Design notes</div><h2>${s.heading}</h2></div>
      <div class="notes">${s.notes}</div>
      <div class="specs">${s.highlights.map(h => `<div class="spec"><div class="k">${h.k}</div><div class="v">${h.v}</div></div>`).join("")}</div>
    </section>`;
  }).join("");

  // Auth sections — single page: desktop screenshot left, feature notes right
  const authPages = authSections.map((s) => `
    <section class="page">
      ${brand(s.label)}
      <div class="page-number">${pn()}</div>
      <div class="section-header" style="margin-top:18mm;">
        <div class="kicker">${s.kicker}</div>
        <h2>${s.heading}</h2>
      </div>
      <div class="auth-layout">
        <div class="auth-wrap">
          <div class="caption">Desktop &middot; 1440 &times; 900 &middot; Authenticated</div>
          <div class="frame">${fh("philanifinance.co.za &mdash; " + s.urlLabel)}
            <div class="frame-body auth-scroll"><img class="auth-img" src="${s.shot}"/></div>
          </div>
        </div>
        <div class="auth-panel">
          <p class="auth-blurb">${s.blurb}</p>
          ${s.features.map(f => `<div class="auth-note"><div class="k">${f.k}</div><div class="v">${f.v}</div></div>`).join("")}
        </div>
      </div>
    </section>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>${css}</style></head><body>${cover}${system}${pubPages}${authPages}</body></html>`;
}

async function main() {
  await loadEnvFiles();
  await ensureDirs();

  const ANON_KEY     = process.env.VITE_SUPABASE_ANON_KEY || "";
  const ADMIN_EMAIL  = process.env.DEMO_ADMIN_EMAIL  || "";
  const ADMIN_PASS   = process.env.DEMO_ADMIN_PASSWORD || "";
  const hasAuth      = !!(ANON_KEY && ADMIN_EMAIL && ADMIN_PASS);

  if (!hasAuth) {
    console.warn("\n⚠  No credentials found — authenticated views will be skipped.");
    console.warn("   Add DEMO_ADMIN_EMAIL and DEMO_ADMIN_PASSWORD to your .env file.\n");
  }

  console.log("Launching browser…");
  const browser = await puppeteer.launch({ headless: "new" });

  // ── Public captures ──────────────────────────────────────────────────
  console.log("\nCapturing public pages…");
  const pub = await capturePublic(browser);

  const pubSections = [
    {
      label: "Landing Page", path: "/",
      heading: "Landing Page — the trust moment",
      desc: "Dark navy hero with live loan calculator, animated stat counters, trust badges and full-bleed CTA.",
      desktopShot: pub.heroD, mobileShot: pub.heroM,
      notes: `<b>Dark navy hero</b> with an embedded loan calculator — amount slider, term selector, and live repayment preview — anchors the above-the-fold experience. Animated stat counters (total disbursed, approval rate, client satisfaction) build instant credibility.<br/><br/><b>TrustBar</b> presents key platform metrics with brand-green icon glows. The <b>CtaBanner</b> is a cinematic full-bleed section with NCR compliance badge. Every element is scroll-triggered with reveal animations.`,
      highlights: [
        { k: "Hero",         v: "Loan calculator · Apply Now / Check Eligibility" },
        { k: "Trust signals", v: "NCR NCRCP18260 · NCA & POPIA compliant" },
        { k: "Header",       v: "Transparent → solid navy on scroll" },
        { k: "Animations",   v: "Scroll reveal · animated stat counters" },
      ],
    },
    {
      label: "How It Works", path: "/#how-it-works",
      heading: "How It Works — four steps to funds",
      desc: "Numbered timeline walks applicants through Apply → Verify → Approve → Payout with time estimates.",
      desktopShot: pub.hiwD, mobileShot: pub.hiwM,
      notes: `<b>Numbered step timeline</b> with icons, estimated durations and color-coded cards walks applicants through the full journey: Apply (2 min) → Verify documents → Approve → Payout (same day). A feature image with floating trust badges adds credibility without clutter.<br/><br/>The layout adapts cleanly to mobile — steps stack vertically and the image collapses gracefully.`,
      highlights: [
        { k: "Steps",         v: "Apply → Verify documents → Approve → Payout" },
        { k: "Time estimates", v: "Avg 2 min application · Same-day payout" },
        { k: "Mobile layout",  v: "Vertical stack · full-width feature image" },
        { k: "Animation",      v: "Step-by-step scroll reveal" },
      ],
    },
    {
      label: "FAQ & CTA", path: "/#faq",
      heading: "FAQ & CTA — compliance and conversion",
      desc: "Smooth accordion FAQ covering eligibility, repayment and NCR compliance, followed by conversion CTA.",
      desktopShot: pub.faqD, mobileShot: pub.faqM,
      notes: `<b>Accordion FAQ</b> with smooth expand/collapse answers common borrower questions around eligibility, repayment, and NCR compliance. Open state highlights in brand-green with chevron rotation provide clear visual feedback.<br/><br/>Below the FAQ the <b>CtaBanner</b> is a full-bleed conversion section with NCR compliance badge. The navy footer lists address, NCR registration, and all legal links.`,
      highlights: [
        { k: "FAQ",        v: "Accordion · smooth height animation" },
        { k: "Open state",  v: "Brand-green border-left · glow shadow" },
        { k: "Compliance",  v: "NCR Reg NCRCP18260 · NCA reference" },
        { k: "Footer",      v: "Address · phone · legal links · NCA warning" },
      ],
    },
  ];

  // ── Authenticated captures ────────────────────────────────────────────
  let authSections = [];

  if (hasAuth) {
    console.log("\nSigning in as " + ADMIN_EMAIL + "…");
    const session = await supabaseSignIn(ADMIN_EMAIL, ADMIN_PASS, ANON_KEY);
    console.log("✓ Authenticated\n");
    console.log("Capturing authenticated views…");
    const auth = await captureAuth(browser, session);

    authSections = [
      {
        label: "Admin Dashboard", kicker: "04 · Admin",
        heading: "Analytics & Portfolio Overview",
        urlLabel: "Admin Dashboard",
        shot: auth.adminAnalytics,
        blurb: "Dark navy header with four live KPI chips — total applications, approval rate, active portfolio value, and total collected. Pipeline progress bars and a 6-month bar chart render from real Supabase data.",
        features: [
          { k: "KPI Chips",       v: "Total apps · Approval rate · Active portfolio · Collected" },
          { k: "Pipeline Chart",  v: "Pending → Reviewing → Approved → Disbursed → Repaid" },
          { k: "Monthly Trend",   v: "6-month animated bar chart from live data" },
          { k: "Stat Cards",      v: "Pending · Reviewing · Approved · Rejected · Avg Loan" },
        ],
      },
      {
        label: "Admin Queue", kicker: "05 · Admin",
        heading: "Application Queue & Search",
        urlLabel: "Admin — Queue",
        shot: auth.adminQueue,
        blurb: "Full application table with real-time search across name, email and ID, status filter dropdown, and sort toggle. Each row shows applicant, loan amount, status badge and a Review action button.",
        features: [
          { k: "Search",   v: "Real-time filter by name, email, ID number" },
          { k: "Filter",   v: "All · Pending · Under Review · Approved · Rejected" },
          { k: "Table",    v: "Applicant · ID · Amount · Status badge · Submitted date" },
          { k: "Action",   v: "Review button → opens detail view · auto status update" },
        ],
      },
      ...(auth.adminDetail ? [{
        label: "Application Detail", kicker: "06 · Admin",
        heading: "Application Review & Action Center",
        urlLabel: "Admin — Detail",
        shot: auth.adminDetail,
        blurb: "Full applicant profile, employment info, banking details, uploaded documents, credit bureau check, internal notes, DebiCheck mandate control, disbursement tracking, and loan contract generation — all in one view.",
        features: [
          { k: "Action Center",   v: "Approve / Reject with mandatory comment" },
          { k: "Credit Check",    v: "Live bureau query · identity verification · score band" },
          { k: "DebiCheck",       v: "NuPay TT1 real-time push mandate initiation" },
          { k: "Disbursement",    v: "Mark disbursed · payment received lifecycle" },
          { k: "Audit Log",       v: "Every action timestamped and stored (POPIA)" },
        ],
      }] : []),
      {
        label: "Application Form", kicker: "07 · Client Portal",
        heading: "Loan Application — Multi-Step Form",
        urlLabel: "Apply",
        shot: auth.applyForm,
        blurb: "Protected multi-step form collects personal details, employment information, banking data, and document uploads. Live repayment calculator updates in real time. Supabase profile pre-fills returning applicants.",
        features: [
          { k: "Steps",        v: "Personal → Employment → Banking → Documents → Submit" },
          { k: "Calculator",   v: "Live repayment preview · interest · service fee · VAT" },
          { k: "Auth gate",    v: "Sign-in required · profile auto-saved to Supabase" },
          { k: "Credit consent", v: "POPIA consent checkbox required before submission" },
        ],
      },
      {
        label: "Client Dashboard", kicker: "08 · Client Portal",
        heading: "Client Dashboard — Application Tracker",
        urlLabel: "Dashboard — Tracker",
        shot: auth.dashTracker,
        blurb: "Personal dark-navy header with real-time application status — Pending, Under Review, Approved, or Rejected — displayed prominently alongside a progress stepper. Loan contract and DebiCheck mandate status visible at a glance.",
        features: [
          { k: "Status tracker",  v: "Pending → Under Review → Approved → Disbursed → Repaid" },
          { k: "Progress steps",  v: "Visual stepper shows where application stands" },
          { k: "Loan contract",   v: "Contract status, number and signed date" },
          { k: "DebiCheck badge", v: "Mandate status (sent / authenticated / rejected)" },
        ],
      },
      {
        label: "Client Dashboard — History", kicker: "09 · Client Portal",
        heading: "Loan History & Documents",
        urlLabel: "Dashboard — History",
        shot: auth.dashHistory,
        blurb: "Loan history tab lists all past and current applications with status badges and submitted dates. Documents tab shows uploaded payslips, bank statements and ID copy with size and MIME type. My Profile tab provides editable personal details.",
        features: [
          { k: "History tab",   v: "All applications · status · submitted date" },
          { k: "Documents tab", v: "Payslips · bank statements · ID copy with metadata" },
          { k: "Profile tab",   v: "Editable personal details saved to Supabase profiles" },
          { k: "Tabs",          v: "Tracker · Loan History · Documents · My Profile" },
        ],
      },
    ];
  }

  await browser.close();

  // ── Render PDF ────────────────────────────────────────────────────────
  console.log("\nRendering PDF…");
  const html = renderHTML(pubSections, authSections);
  const htmlFile = path.join(OUT_DIR, "deck.html");
  await fs.writeFile(htmlFile, html, "utf8");

  const pdfBrowser = await puppeteer.launch({ headless: "new" });
  const pdfPage = await pdfBrowser.newPage();
  await pdfPage.goto("file:///" + htmlFile.replaceAll("\\", "/"), { waitUntil: "networkidle0" });
  await new Promise(r => setTimeout(r, 2000)); // let Google Fonts settle
  const pdfPath = path.join(OUT_DIR, "Philani-Finance_Design-Deck.pdf");
  await pdfPage.pdf({
    path: pdfPath,
    width: "420mm",
    height: "297mm",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await pdfPage.close();
  await pdfBrowser.close();

  const stat = await fs.stat(pdfPath);
  console.log(`\n✓ Deck ready → ${pdfPath}`);
  console.log(`  Pages: ${2 + pubSections.length * 2 + authSections.length}  |  Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
