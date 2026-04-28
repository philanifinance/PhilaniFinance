import { useState, useMemo } from 'react';
import { ArrowRight, CalendarDays, TrendingUp, Receipt, LogIn } from 'lucide-react';
import { calcLoan, formatCurrency, formatDate } from '../lib/loanCalculator';

interface HeroProps {
  isAuthenticated: boolean;
  onRequestAuth: () => void;
  onApply: () => void;
  onApplyWithParams?: (amount: number, days: number) => void;
}

export default function Hero({ isAuthenticated, onRequestAuth, onApply, onApplyWithParams }: HeroProps) {
  const [amount, setAmount] = useState(2000);
  const [days, setDays] = useState(14);

  const calc = useMemo(() => calcLoan(amount, days), [amount, days]);

  return (
    <section className="relative min-h-screen bg-[#f8fafc] flex items-center overflow-hidden pt-16">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#22c55e]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left column */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-pulse" />
              <span className="text-[#16a34a] text-xs font-semibold uppercase tracking-wider">Applications Open</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 leading-tight mb-6">
              Cash When You<br />
              <span className="text-[#22c55e]">Need It Most</span>
            </h1>

            <p className="text-gray-600 text-lg leading-relaxed mb-8 max-w-lg">
              Fast, responsible micro-loans for South Africans. Apply in minutes, get a decision quickly, and receive funds directly to your bank account.
            </p>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><span className="text-[#22c55e]">✓</span> No hidden fees</span>
              <span className="flex items-center gap-1.5"><span className="text-[#22c55e]">✓</span> NCR Registered</span>
              <span className="flex items-center gap-1.5"><span className="text-[#22c55e]">✓</span> 256-bit SSL secure</span>
            </div>
          </div>

          {/* Calculator card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xl shadow-gray-200/50">
            <h2 className="text-gray-900 font-bold text-xl mb-6">Calculate Your Loan</h2>

            {/* Amount slider */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 text-sm font-medium">Loan Amount</span>
                <span className="text-[#22c55e] font-bold text-lg">{formatCurrency(amount)}</span>
              </div>
              <input
                type="range"
                min={500}
                max={8000}
                step={100}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#22c55e]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>R 500</span>
                <span>R 8,000</span>
              </div>
            </div>

            {/* Term slider */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600 text-sm font-medium">Repayment Term</span>
                <span className="text-[#22c55e] font-bold text-lg">{days} days</span>
              </div>
              <input
                type="range"
                min={1}
                max={35}
                step={1}
                value={days}
                onChange={e => setDays(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#22c55e]"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 day</span>
                <span>35 days</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3 border border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Interest</span>
                <span className="text-gray-900 font-medium">{formatCurrency(calc.interest)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Service Fee</span>
                <span className="text-gray-900 font-medium">{formatCurrency(calc.serviceFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT (15%)</span>
                <span className="text-gray-900 font-medium">{formatCurrency(calc.vat)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between">
                <span className="text-gray-900 font-bold">Total Repayable</span>
                <span className="text-[#22c55e] font-black text-lg">{formatCurrency(calc.totalRepayable)}</span>
              </div>
              <div className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100">
                <span className="text-gray-600 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Repayment Date</span>
                <span className="text-gray-900 font-semibold">{formatDate(calc.repaymentDate)}</span>
              </div>
            </div>

            {isAuthenticated ? (
              <button
                onClick={() => onApplyWithParams ? onApplyWithParams(amount, days) : onApply()}
                className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-green-500/30 hover:-translate-y-0.5"
              >
                Apply for {formatCurrency(amount)}
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={onRequestAuth}
                className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-green-500/30 hover:-translate-y-0.5"
              >
                Sign In to Apply for {formatCurrency(amount)}
                <LogIn className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
