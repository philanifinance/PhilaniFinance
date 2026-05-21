// ── NCR constraints (National Credit Act, South Africa) ──────────────
const NCR = {
  MONTHLY_INTEREST_RATE: 0.05,    // 5% per month (NCR maximum)
  MONTHLY_SERVICE_FEE:   79.35,   // R79.35 per month fixed (NCR cap, incl. VAT)
  INITIATION_CAP:        1050.00, // hard cap on initiation fee per NCA
  TOTAL_COST_TARGET:     0.30,    // target total cost of credit as % of principal
  MIN_TERM:              1,       // months
  MAX_TERM:              6,       // months
} as const;

// ── Full output type ──────────────────────────────────────────────────
export interface LoanQuote {
  // Engine outputs
  principal:          number;
  term:               number;   // months (1–6)
  initiationFee:      number;
  monthlyInterest:    number;
  monthlyServiceFee:  number;
  totalInterest:      number;
  totalServiceFees:   number;
  totalRepayment:     number;
  effectiveYield:     number;
  repaymentDate:      Date;
  termDays:           number;   // term × 30 — for DB submission
  // Backward-compat aliases consumed by existing UI / form
  interest:           number;   // totalCharges → "Interest & Service Fees" row
  serviceFee:         number;   // 0 (merged into interest line)
  vat:                number;   // 0 (VAT included in service fee)
  totalRepayable:     number;   // alias for totalRepayment
}

export function calcLoan(principal: number, termMonths?: number): LoanQuote {
  // Guard: ensure a sane positive number; fall back to R500 minimum
  const p = (typeof principal === 'number' && isFinite(principal) && principal > 0)
    ? Math.round(principal)
    : 500;

  // Step 1 — Monthly charge components (fixed per NCR)
  const monthlyInterest   = round2(p * NCR.MONTHLY_INTEREST_RATE);
  const monthlyServiceFee = NCR.MONTHLY_SERVICE_FEE;
  const monthlyTotal      = monthlyInterest + monthlyServiceFee;

  // Step 2 — Determine term
  // Use caller-supplied value when valid; otherwise find the term where the
  // initiation fee cap binds (larger loans), defaulting to 1 for payday loans.
  const suppliedValid =
    typeof termMonths === 'number' &&
    isFinite(termMonths) &&
    termMonths >= NCR.MIN_TERM &&
    termMonths <= NCR.MAX_TERM;

  let term: number;
  if (suppliedValid) {
    term = Math.round(termMonths as number);
  } else {
    // When initiation cap binds, solve: cap + monthlyTotal × term = TOTAL_COST_TARGET × p
    const capBindsTerm = (NCR.TOTAL_COST_TARGET * p - NCR.INITIATION_CAP) / monthlyTotal;
    term = capBindsTerm > NCR.MIN_TERM ? Math.round(capBindsTerm) : NCR.MIN_TERM;
  }

  // Step 3 — Clamp to [1, 6]; guard against NaN/Infinity
  term = Math.min(NCR.MAX_TERM, Math.max(NCR.MIN_TERM, isFinite(term) ? term : 1));

  // Step 4 — Derive initiation fee to hit TOTAL_COST_TARGET for this term
  // Formula: initiationFee = (30% × p) − (monthly charges × term), capped at R1 050
  const initiationFee = round2(
    Math.min(NCR.INITIATION_CAP, Math.max(0, NCR.TOTAL_COST_TARGET * p - monthlyTotal * term))
  );

  // Step 5 — Final totals
  const totalInterest    = round2(monthlyInterest   * term);
  const totalServiceFees = round2(monthlyServiceFee * term);
  const taxableFees      = round2(initiationFee + totalServiceFees); // VAT-applicable (not interest)
  const vat              = round2(taxableFees * 0.15);               // 15% VAT on fees only
  const totalCharges     = round2(totalInterest + taxableFees + vat);
  const totalRepayment   = round2(p + totalCharges);
  const effectiveYield   = parseFloat((totalCharges / p).toFixed(4));

  const termDays = term * 30;
  const repaymentDate = new Date();
  repaymentDate.setDate(repaymentDate.getDate() + termDays);

  return {
    principal:         p,
    term,
    initiationFee,
    monthlyInterest,
    monthlyServiceFee,
    totalInterest,
    totalServiceFees,
    totalRepayment,
    effectiveYield,
    repaymentDate,
    termDays,
    // backward-compat
    interest:       round2(totalInterest + taxableFees), // pre-VAT charges
    serviceFee:     0,
    vat,
    totalRepayable: totalRepayment,
  };
}

function round2(n: number): number {
  return parseFloat(n.toFixed(2));
}

export function formatCurrency(value: number): string {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}
