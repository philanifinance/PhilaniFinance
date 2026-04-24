export const DAILY_INTEREST_RATE = 0.0015; // 0.15%
export const SERVICE_FEE_BASE = 60;
export const SERVICE_FEE_PERCENT = 0.10;
export const VAT_RATE = 0.15;

export function calcLoan(amount: number, days: number) {
  const interest = amount * DAILY_INTEREST_RATE * days;
  const serviceFee = SERVICE_FEE_BASE + amount * SERVICE_FEE_PERCENT;
  const vat = (serviceFee + interest) * VAT_RATE;
  const total = amount + interest + serviceFee + vat;

  const repaymentDate = new Date();
  repaymentDate.setDate(repaymentDate.getDate() + days);

  return {
    interest: parseFloat(interest.toFixed(2)),
    serviceFee: parseFloat(serviceFee.toFixed(2)),
    vat: parseFloat(vat.toFixed(2)),
    totalRepayable: parseFloat(total.toFixed(2)),
    repaymentDate,
  };
}

export function formatCurrency(value: number): string {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}
