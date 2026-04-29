import { useState, useMemo } from 'react';
import { ArrowRight, CalendarDays, TrendingUp, Receipt, ShieldCheck, Zap, Lock } from 'lucide-react';
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

  const amountPct = ((amount - 500) / 7500) * 100;
  const daysPct = ((days - 1) / 34) * 100;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Sophisticated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/40" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-60 -right-60 w-[600px] h-[600px] rounded-full bg-brand-500/[0.04] blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-500/[0.04] blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-brand-500/[0.02] blur-3xl" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column — Persuasion */}
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2.5 bg-brand-500/8 border border-brand-500/15 rounded-full px-4 py-2 mb-8">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
              </span>
              <span className="text-brand-700 text-xs font-semibold tracking-wide">Applications Open — Instant Decisions</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold text-navy-900 leading-[1.1] mb-6 tracking-tight">
              Dignified Lending<br />
              for Your Dreams,{' '}
              <span className="relative">
                <span className="text-brand-500">in Minutes</span>
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none"><path d="M2 6C50 2 150 2 198 6" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" opacity="0.3" /></svg>
              </span>
            </h1>

            <p className="font-body text-navy-500 text-lg leading-relaxed mb-8 max-w-lg">
              No paper forms. Secure, instant verification. Get a decision in minutes and funds sent directly to your account — dignified and transparent.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
              {[
                { icon: ShieldCheck, text: 'NCR Registered' },
                { icon: Lock, text: '256-bit Encrypted' },
                { icon: Zap, text: 'Same-Day Payout' },
              ].map(({ icon: I, text }) => (
                <span key={text} className="flex items-center gap-2 text-navy-500">
                  <span className="w-7 h-7 rounded-lg bg-brand-500/8 flex items-center justify-center">
                    <I className="w-3.5 h-3.5 text-brand-600" />
                  </span>
                  <span className="font-medium">{text}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Calculator card */}
          <div className="animate-slide-left bg-white rounded-3xl p-6 sm:p-8 shadow-2xl shadow-navy-900/[0.08] border border-gray-200/60 ring-1 ring-gray-100">
            <div className="flex items-center justify-between mb-7">
              <h2 className="font-display text-navy-900 font-bold text-xl">Loan Calculator</h2>
              <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full uppercase tracking-wide">Live Quote</span>
            </div>

            {/* Amount slider */}
            <div className="mb-7">
              <div className="flex justify-between items-end mb-3">
                <span className="text-navy-500 text-sm font-medium">How much do you need?</span>
                <span className="font-display text-brand-600 font-bold text-2xl tabular-nums">{formatCurrency(amount)}</span>
              </div>
              <input
                type="range" min={500} max={8000} step={100} value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full cursor-pointer"
                style={{ '--range-pct': `${amountPct}%` } as React.CSSProperties}
              />
              <div className="flex justify-between text-xs text-navy-400 mt-1.5 font-medium">
                <span>R 500</span>
                <span>R 8,000</span>
              </div>
            </div>

            {/* Term slider */}
            <div className="mb-7">
              <div className="flex justify-between items-end mb-3">
                <span className="text-navy-500 text-sm font-medium">Repayment period</span>
                <span className="font-display text-brand-600 font-bold text-2xl tabular-nums">{days} <span className="text-base font-semibold text-navy-400">days</span></span>
              </div>
              <input
                type="range" min={1} max={35} step={1} value={days}
                onChange={e => setDays(Number(e.target.value))}
                className="w-full cursor-pointer"
                style={{ '--range-pct': `${daysPct}%` } as React.CSSProperties}
              />
              <div className="flex justify-between text-xs text-navy-400 mt-1.5 font-medium">
                <span>1 day</span>
                <span>35 days</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-navy-50/60 rounded-2xl p-5 mb-7 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-navy-500 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-navy-400" /> Interest</span>
                <span className="text-navy-800 font-semibold tabular-nums">{formatCurrency(calc.interest)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-500 flex items-center gap-2"><Receipt className="w-3.5 h-3.5 text-navy-400" /> Service Fee</span>
                <span className="text-navy-800 font-semibold tabular-nums">{formatCurrency(calc.serviceFee)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-navy-500">VAT (15%)</span>
                <span className="text-navy-800 font-semibold tabular-nums">{formatCurrency(calc.vat)}</span>
              </div>
              <div className="border-t border-navy-200/50 pt-3 flex justify-between items-center">
                <span className="text-navy-900 font-bold text-sm">Total Repayable</span>
                <span className="font-display text-brand-600 font-extrabold text-xl tabular-nums">{formatCurrency(calc.totalRepayable)}</span>
              </div>
              <div className="flex items-center justify-between text-sm bg-white rounded-xl px-4 py-2.5 border border-navy-100">
                <span className="text-navy-500 flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5 text-navy-400" /> Due date</span>
                <span className="text-navy-900 font-semibold">{formatDate(calc.repaymentDate)}</span>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => isAuthenticated ? (onApplyWithParams ? onApplyWithParams(amount, days) : onApply()) : onRequestAuth()}
              className="group w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5 animate-glow"
            >
              <span className="font-display text-base">
                {isAuthenticated ? `Apply for ${formatCurrency(amount)}` : 'Check My Eligibility (Fast)'}
              </span>
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <p className="text-center text-navy-400 text-[11px] mt-3 font-medium">No impact on your credit score</p>
          </div>
        </div>
      </div>
    </section>
  );
}
