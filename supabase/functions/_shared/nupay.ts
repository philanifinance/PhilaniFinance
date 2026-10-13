// Shared helpers for NuPay DebiCheck webservice integration.
//
// Source of truth: the specification PDFs in the "NuPayment Integration"
// folder (Mandate Initiation v3.7, Mandate Maintenance v3, Mandate Status
// v1.5, Settlement Report v1.4, Mandate and Instalment Reporting v2.6).
//
// Important: there is no webhook/push mechanism documented anywhere in the
// NuPay DebiCheck specs. Every method is a synchronous JSON request/response
// webservice, authenticated per-request with a Base64("username:password")
// string in the "auth" field of the request body (not an HTTP header, and
// not a bearer token obtained from a separate auth endpoint). Status updates
// are obtained by polling the Mandate Status webservice.

export const NUPAY_BASE_URL = 'https://btm.nupay.co.za/wsDebiCheck';

export function nupayAuth(): string {
  const username = Deno.env.get('NUPAY_USERNAME') || '';
  const password = Deno.env.get('NUPAY_PASSWORD') || '';
  return btoa(`${username}:${password}`);
}

// Card acceptor / merchant number / access_id — must be zero-padded to 15 digits.
export function merchantNumber(): string {
  const raw = Deno.env.get('NUPAY_MERCHANT_ID') || '';
  return raw.padStart(15, '0');
}

export async function nupayPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${NUPAY_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth: nupayAuth(), ...body }),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`NuPay returned a non-JSON response (HTTP ${res.status}): ${text.slice(0, 500)}`);
  }

  if (!res.ok) {
    throw new Error(`NuPay webservice error (HTTP ${res.status}): ${JSON.stringify(parsed)}`);
  }

  return parsed as T;
}

// ── Appendix 5.5 / 3.6 — Financial Institution ID ─────────────────────
// Maps the bank names used in this app's loan application form to the
// numeric Financial Institution ID NuPay requires in "debtorBankId".
// Banks not present in the NuPay DebiCheck appendix (e.g. Investec) are
// not supported for DebiCheck collection and resolve to `undefined`.
export const FINANCIAL_INSTITUTION_ID: Record<string, string> = {
  'Standard Bank': '1',
  'Nedbank': '2',
  'FNB': '3',
  'African Bank': '7',
  'Mercantile': '9',
  'Capitec': '10',
  'Ubank': '19',
  'Absa': '16',
  'Bidvest': '44',
  'Finbond': '55',
  'TymeBank': '61',
  'Discovery Bank': '63',
  'Old Mutual Bank': '67',
};

// ── Appendix 5.6 / 3.7 — Bank Universal Branch Codes ───────────────────
export const UNIVERSAL_BRANCH_CODE: Record<string, string> = {
  'Standard Bank': '051001',
  'Nedbank': '198765',
  'FNB': '250655',
  'African Bank': '430000',
  'Mercantile': '450105',
  'Capitec': '470010',
  'Ubank': '431010',
  'Absa': '632005',
  'Bidvest': '462005',
  'Finbond': '589000',
  'TymeBank': '678910',
  'Discovery Bank': '679000',
  'Old Mutual Bank': '352000',
};

// ── Appendix 5.4 / 3.5 — Account Type ──────────────────────────────────
export function mapAccountType(type: string): string {
  const map: Record<string, string> = {
    cheque: '01',       // Current Account
    current: '01',
    savings: '02',
    transmission: '03',
  };
  return map[type.toLowerCase()] || '01';
}

// ── Debit Value Type (Appendix 5.7 / 3.8) ──────────────────────────────
export const DEBIT_VALUE_TYPE_FIXED = '1';

// ── Entry Class (Appendix 5.8 / 7.5) ───────────────────────────────────
// 0033 = Loan Repayment (other than Mortgage) — matches this product.
export const ENTRY_CLASS_LOAN_REPAYMENT = '0033';

// ── Mandate Cancellation Reason Codes (Appendix 3.11) ──────────────────
export const CANCEL_REASON_MERCHANT_REQUESTED = 'MD17';

// ── Frequency mapping ───────────────────────────────────────────────────
// NuPay has no "once-off" frequency code; a single debit is modelled as a
// 1-instalment mandate whose firstCollectionAmount/firstCollectionDate
// carry the one debit (see Mandate Initiation spec §4.3, "Instalment amount").
export type AppFrequency = 'once-off' | 'weekly' | 'monthly';

export function mapFrequency(freq: AppFrequency): string {
  const map: Record<AppFrequency, string> = {
    'once-off': 'MNTH',
    weekly: 'WEEK',
    monthly: 'MNTH',
  };
  return map[freq] || 'MNTH';
}

// Derives a valid "collectionDay" for the given frequency code from the
// first collection date, per Appendix 5.2 / 3.3.
export function deriveCollectionDay(nuPayFrequency: string, isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (nuPayFrequency === 'WEEK') {
    // 01 (Monday) .. 07 (Sunday)
    const isoWeekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    return String(isoWeekday).padStart(2, '0');
  }
  // MNTH / QURT / MIAN / YEAR: 01-30, or 99 for the last day of the month.
  const day = date.getUTCDate();
  const lastDayOfMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  if (day >= lastDayOfMonth) return '99';
  return String(Math.min(day, 30)).padStart(2, '0');
}

// Formats a local SA mobile number (e.g. "0821234567") to the format NuPay
// validates against (confirmed via live testing — NuPay error 500016
// "Debtor phone number format" — to be "+27-821234567", a dash between the
// country code and the 9-digit national number; the spec's own example,
// "+27 -823509883", matches this once its stray OCR space is removed).
export function formatDebtorPhone(mobile: string): string {
  let digits = mobile.replace(/\D/g, '');
  if (digits.startsWith('27') && digits.length === 11) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return `+27-${digits}`;
}

export function formatZarAmount(amount: number): string {
  return amount.toFixed(2);
}

// ── Instalment Maintenance specific formatting ─────────────────────────
// Unlike Mandate Initiation (decimal rand strings, e.g. "500.00"), the
// Instalment Maintenance spec states amounts are in CENTS (e.g. 100 for
// R1.00) and dates are plain YYYYMMDD with no dashes.
export function randsToCents(amount: number): number {
  return Math.round(amount * 100);
}

// Every rand-amount column touched by instalment data (debicheck_mandates,
// debicheck_instalments) is INTEGER — whole rands only, matching the
// convention used throughout this schema (e.g. loan_applications.loan_amount)
// — so this rounds to the nearest whole rand rather than returning cents-
// level decimal precision an INTEGER column can't actually store.
export function centsToRands(cents: number): number {
  return Math.round(cents / 100);
}

export function toCompactDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

// ── Instalment status (Instalment Maintenance appendix 2.7) ───────────
export type InstalmentStatus = 'pending' | 'collected' | 'failed' | 'waived' | 'cancelled';

// Status vocabulary for the Instalment MAINTENANCE webservice's own
// responses (add/maintain/reschedule/cancel/reactivate) — single letter
// codes per its appendix 2.7.
export function mapInstalmentStatus(code: string | undefined | null): InstalmentStatus {
  switch ((code || '').trim().toUpperCase()) {
    case 'X': return 'collected';
    case 'H': return 'failed';
    case 'I': return 'pending';   // in tracking — still being retried
    case 'P': return 'pending';   // future
    case 'C': return 'cancelled';
    default: return 'pending';
  }
}

// Status vocabulary for the Mandate and Instalment REPORTING webservice's
// "status" field — a different, human-readable set of values ("Successful",
// "Failed", "In Tracking", "Disputed", "Pending (Future)" per spec §6.3) and
// NOT the single-letter codes above, despite both describing an instalment.
// Matched by substring rather than exact value: a live response returned
// "Cancelled", which isn't in the spec's own documented value list at all —
// same lesson as elsewhere in this integration, the PDF isn't fully
// reliable, so this degrades gracefully for any value we haven't seen yet.
export function mapInstalmentReportStatus(status: string | undefined | null): InstalmentStatus {
  const s = (status || '').toLowerCase();
  if (s.includes('success')) return 'collected';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('fail')) return 'failed';
  // "Disputed" has no direct equivalent in this app's instalment status
  // enum — treated as "failed" (a collection outcome needing attention)
  // rather than invented as a new DB enum value.
  if (s.includes('disput')) return 'failed';
  return 'pending'; // "In Tracking", "Pending (Future)", or anything unrecognised
}

// ── Mandate Status Grouping (shared by Mandate Status & Mandate/Instalment
// Reporting specs, appendix 6.4 / 7.6) — the authoritative way to collapse
// NuPay's many granular statuses into this app's internal lifecycle states.
export type InternalMandateStatus =
  | 'draft' | 'mandate_submitted' | 'pending_bank' | 'accepted' | 'rejected' | 'cancelled' | 'error';

const PENDING_STATUSES = new Set(['pending auth', 'posted', 'requested', 'queued', 'extracted']);
const REJECTED_STATUSES = new Set(['expired', 'no response', 'not authorized', 'not authorised', 'rejected', 'cancelled', 'suspended', 'failed', 'declined']);
const ACTIVE_STATUSES = new Set(['accepted', 'active', 'completed']);

export function mapNuPayStatusGrouping(status: string, grouping?: string): InternalMandateStatus {
  const normalizedStatus = (status || '').toLowerCase().trim();
  const normalizedGrouping = (grouping || '').toLowerCase().trim();

  // A mandate that was specifically cancelled should stay distinguishable
  // from a generic rejection, even though NuPay groups it under "Rejected".
  if (normalizedStatus === 'cancelled') return 'cancelled';

  if (normalizedGrouping === 'pending' || PENDING_STATUSES.has(normalizedStatus)) return 'pending_bank';
  if (normalizedGrouping === 'rejected' || REJECTED_STATUSES.has(normalizedStatus)) return 'rejected';
  if (normalizedGrouping === 'active' || ACTIVE_STATUSES.has(normalizedStatus)) return 'accepted';

  // Only truly ambiguous responses (no status, no grouping — e.g. an HTTP
  // 200 with an empty/unexpected body) default to "pending": NuPay's own
  // documented Status values are fully covered above, so anything else that
  // actually came back non-empty (e.g. "Failed" from a gateway error) is
  // closer to a rejection than a wait-and-see pending state.
  if (!normalizedStatus && !normalizedGrouping) return 'pending_bank';
  return 'rejected';
}

// ── NuPay/CAPI gateway-level error codes (Appendix 5.10 / 3.10 / 7.1) ──
// These 500xxx codes mean the REQUEST itself was malformed/rejected before
// it ever reached the bank — distinct from the 900xxx/901xxx/902xxx
// DebiCheck response codes that describe an actual mandate/debit outcome.
// A gateway error should map to this app's "error" bucket (our integration
// sent something NuPay didn't accept), not "rejected" (bank/debtor declined
// a validly-formed mandate).
export function isGatewayErrorCode(code: string | undefined | null): boolean {
  if (!code) return false;
  const trimmed = code.trim();
  return /^5\d{5}$/.test(trimmed) && trimmed !== '500000';
}

// ── Response code descriptions (trimmed to the most common outcomes) ──
// Full tables are in the spec PDFs (DebiCheck Appendix 5.9/3.9/7.2 and
// NuPay Appendix 5.10/3.10/7.1). Unknown codes fall back to the raw code.
export const RESPONSE_CODE_DESCRIPTIONS: Record<string, string> = {
  '900000': 'Transaction successful — mandate accepted / debit successful',
  '900002': 'Insufficient funds',
  '900003': 'Debits not allowed on this account',
  '900004': 'Payment stopped by account holder',
  '900005': 'Dormant/inactive account',
  '900006': 'Account frozen',
  '900008': 'Account in liquidation',
  '900010': 'Account in sequestration',
  '900012': 'Account closed',
  '900018': 'Account holder deceased',
  '900022': 'Account effects not cleared (insufficient funds, tracked)',
  '900026': 'No such account',
  '900040': 'Item limit exceeded',
  '900044': 'Debtor bank system issue — no action needed, bank will respond once resolved',
  '900048': 'Debtor account number fails CDV routine',
  '900056': 'Not FICA compliant',
  '900099': 'Held for representment (insufficient funds, in tracking)',
  '902118': 'Debtor account is not open and active',
  '902119': 'Unable to reach debtor for authentication',
  '902126': 'Mandate is not in a status to be cancelled',
  '902145': 'Mandate has expired',
  '902146': 'Mandate initiation request has expired',
  '902204': 'Mandate already exists',
  '500000': 'Success',
  '500002': 'Invalid inputs',
  '500006': 'Internal web service error',
  '500007': 'Internal error',
  '500014': 'Contract reference needs to be unique',
  '500015': 'Invalid amount format',
  '500016': 'Invalid debtor phone number format',
  '500017': 'Invalid debtor email address format',
  '500018': 'Mandate not found',
  '500019': 'Invalid amendment reason',
  '500020': 'Invalid cancellation reason',
  '500039': 'Mandate not found',
  '500040': 'Change not applied',
  '500080': 'Start date cannot be in the past',
  '500089': 'Invalid number of instalments (maximum 9999)',
  '500082': 'Collection amount limit exceeded',
  // Debtor-response outcomes (Mandate Status appendix 6.3 / Mandate
  // Initiation appendix 5.9) — these can also appear as the ErrorCode on a
  // nested ErrorMessage entry in an initiation response.
  'AAUT': 'Debtor authenticated the mandate',
  'NAUT': 'Debtor did not authenticate the mandate',
  'NRSP': 'Debtor did not respond in time',
};

export function describeResponseCode(code: string | undefined | null): string | undefined {
  if (!code) return undefined;
  return RESPONSE_CODE_DESCRIPTIONS[code.trim()];
}
