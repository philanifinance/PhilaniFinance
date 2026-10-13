import { describe, it, expect } from 'vitest';
import { calcLoan } from './loanCalculator';

describe('calcLoan', () => {
  it('honours an explicit, in-range term', () => {
    expect(calcLoan(2000, 3).term).toBe(3);
  });

  it('treats an out-of-range explicit term as not supplied, falling back to the auto-selected term rather than clamping it directly', () => {
    expect(calcLoan(2000, 0).term).toBe(calcLoan(2000).term);
    expect(calcLoan(2000, 12).term).toBe(calcLoan(2000).term);
  });

  it('auto-selects term 1 for a small loan where the initiation cap never binds', () => {
    expect(calcLoan(500).term).toBe(1);
  });

  it('clamps the auto-selected term to a maximum of 6 months for a large loan', () => {
    expect(calcLoan(200000).term).toBe(6);
  });

  it('falls back to a sane default when principal is invalid', () => {
    expect(calcLoan(NaN).principal).toBe(500);
    expect(calcLoan(-100).principal).toBe(500);
    expect(calcLoan(0).principal).toBe(500);
    expect(calcLoan(Infinity).principal).toBe(500);
  });

  it('rounds a fractional principal to the nearest rand', () => {
    expect(calcLoan(1999.6, 1).principal).toBe(2000);
  });

  it('never exceeds the NCR initiation fee cap, even for large loans', () => {
    const quote = calcLoan(50000, 6);
    expect(quote.initiationFee).toBeLessThanOrEqual(1050);
  });

  it('never produces a negative initiation fee for small loans', () => {
    const quote = calcLoan(500, 1);
    expect(quote.initiationFee).toBeGreaterThanOrEqual(0);
  });

  it('total repayment always equals principal plus the itemised charges', () => {
    const quote = calcLoan(3000, 2);
    const expectedCharges = round2(quote.totalInterest + quote.initiationFee + quote.totalServiceFees + quote.vat);
    expect(quote.totalRepayment).toBeCloseTo(quote.principal + expectedCharges, 2);
  });

  it('charges exactly one month of interest/service fee per term month', () => {
    const quote = calcLoan(1000, 4);
    expect(quote.totalInterest).toBeCloseTo(quote.monthlyInterest * 4, 2);
    expect(quote.totalServiceFees).toBeCloseTo(quote.monthlyServiceFee * 4, 2);
  });

  it('applies monthly interest at exactly the NCR-capped 5% rate', () => {
    expect(calcLoan(1000, 1).monthlyInterest).toBeCloseTo(50, 2);
    expect(calcLoan(2000, 1).monthlyInterest).toBeCloseTo(100, 2);
  });

  it('termDays is always term months × 30, matching what gets submitted to the DB', () => {
    expect(calcLoan(1000, 3).termDays).toBe(90);
    expect(calcLoan(1000, 6).termDays).toBe(180);
  });

  it('sets repaymentDate termDays in the future', () => {
    const before = Date.now();
    const quote = calcLoan(1000, 1);
    const diffDays = Math.round((quote.repaymentDate.getTime() - before) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(quote.termDays);
  });

  it('keeps the backward-compat aliases in sync with the engine fields', () => {
    const quote = calcLoan(1500, 2);
    expect(quote.totalRepayable).toBe(quote.totalRepayment);
    expect(quote.serviceFee).toBe(0);
  });

  it('effectiveYield reflects total charges as a fraction of principal', () => {
    const quote = calcLoan(1000, 1);
    const totalCharges = round2(quote.totalInterest + quote.initiationFee + quote.totalServiceFees + quote.vat);
    expect(quote.effectiveYield).toBeCloseTo(totalCharges / quote.principal, 3);
  });
});

function round2(n: number): number {
  return parseFloat(n.toFixed(2));
}
