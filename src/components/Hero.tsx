import { useState, useMemo } from 'react';
import { ArrowRight, CalendarDays, TrendingUp, ShieldCheck, Zap, Lock, ChevronDown } from 'lucide-react';
import { calcLoan, formatCurrency, formatDate } from '../lib/loanCalculator';

interface HeroProps {
  isAuthenticated: boolean;
  onRequestAuth: () => void;
  onApply: () => void;
  onApplyWithParams?: (amount: number, days: number) => void;
}

// High-resolution Unsplash — modern South African urban lifestyle
const HERO_IMAGE = 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1800&auto=format&fit=crop&q=90';

export default function Hero({ isAuthenticated, onRequestAuth, onApply, onApplyWithParams }: HeroProps) {
  const [amount, setAmount] = useState(2000);
  const calc = useMemo(() => calcLoan(amount, 1), [amount]);
  const amountPct = ((amount - 500) / 7500) * 100;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">

      {/* ── Cinematic full-bleed photo background ── */}
      <div className="absolute inset-0">
        <img
          src={HERO_IMAGE}
          alt=""
          className="w-full h-full object-cover object-center"
        />
        {/* Layered dark overlay — heavier on left for legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-950/75 to-navy-950/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 via-transparent to-navy-950/20" />
      </div>

      {/* ── Content ── */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-28 w-full">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">

          {/* Left — copy */}
          <div className="animate-fade-up">
            {/* Status pill */}
            <div className="inline-flex items-center gap-2.5 bg-white/[0.06] border border-white/[0.1] backdrop-blur-sm rounded-full px-4 py-2 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
              </span>
              <span className="text-white/70 text-xs font-medium tracking-wide">Applications Open · Instant Decisions</span>
            </div>

            <h1 className="font-display font-extrabold text-white leading-[1.06] tracking-tight mb-4"
                style={{ fontSize: 'clamp(2.4rem, 5vw, 3.8rem)' }}>
              The Smarter Way<br />
              to <span className="gradient-text">Borrow Money</span>
            </h1>

            <div className="flex items-center gap-3 mb-7">
              <span className="h-px w-8 bg-brand-500/50 flex-shrink-0" />
              <p className="text-[11px] font-extrabold uppercase tracking-[0.26em] whitespace-nowrap">
                <span className="text-white/45">Pay Day Too Far</span>
                <span className="text-brand-500 mx-2">·</span>
                <span className="text-brand-400">We Got You</span>
              </p>
            </div>

            <p className="text-white/60 text-lg leading-relaxed mb-10 max-w-md">
              Secure, fully digital micro-loans for South Africans. No queues, no paperwork — a decision within hours.
            </p>

            {/* Trust row */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: ShieldCheck, text: 'NCR Registered' },
                { icon: Lock,        text: '256-bit Encrypted' },
                { icon: Zap,         text: 'Same-Day Payout' },
              ].map(({ icon: I, text }) => (
                <div key={text} className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.09] backdrop-blur-sm rounded-full px-4 py-2">
                  <I className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                  <span className="text-white/75 text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — calculator */}
          <div className="animate-slide-left">
            <div className="bg-white rounded-3xl p-7 sm:p-8 shadow-[0_32px_80px_rgba(0,0,0,0.35)]">

              <div className="flex items-center justify-between mb-7">
                <h2 className="font-display text-navy-900 font-bold text-xl">Loan Calculator</h2>
                <span className="text-[10px] font-bold text-brand-700 bg-brand-50 border border-brand-100 px-3 py-1.5 rounded-full uppercase tracking-widest">Live</span>
              </div>

              {/* Amount */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-navy-500 text-sm font-medium">Loan amount</span>
                  <span className="font-display text-brand-600 font-extrabold text-2xl tabular-nums">{formatCurrency(amount)}</span>
                </div>
                <input type="range" min={500} max={8000} step={100} value={amount}
                  onChange={e => setAmount(Number(e.target.value))} className="w-full cursor-pointer"
                  style={{ '--range-pct': `${amountPct}%` } as React.CSSProperties} />
                <div className="flex justify-between text-xs text-navy-400 mt-1.5 font-medium">
                  <span>R 500</span><span>R 8,000</span>
                </div>
              </div>


              {/* Breakdown */}
              <div className="bg-slate-50 rounded-2xl divide-y divide-slate-100 mb-6 overflow-hidden">
                <div className="flex justify-between items-center px-5 py-3 text-sm">
                  <span className="text-navy-500 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-navy-400" />Interest &amp; Service Fees
                  </span>
                  <span className="text-navy-700 font-semibold tabular-nums">{formatCurrency(calc.interest)}</span>
                </div>
                <div className="flex justify-between items-center px-5 py-3 text-sm">
                  <span className="text-navy-500">VAT (15%)</span>
                  <span className="text-navy-700 font-semibold tabular-nums">{formatCurrency(calc.vat)}</span>
                </div>
                <div className="flex justify-between items-center px-5 py-3.5 bg-white">
                  <span className="text-navy-900 font-bold text-sm">Total Repayable</span>
                  <span className="font-display text-brand-600 font-extrabold text-lg tabular-nums">{formatCurrency(calc.totalRepayable)}</span>
                </div>
                <div className="flex justify-between items-center px-5 py-3 text-sm">
                  <span className="text-navy-500 flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5 text-navy-400" />Due date</span>
                  <span className="text-navy-700 font-semibold">{formatDate(calc.repaymentDate)}</span>
                </div>
              </div>

              {/* CTA */}
              <button
                onClick={() => isAuthenticated ? (onApplyWithParams ? onApplyWithParams(amount, 1) : onApply()) : onRequestAuth()}
                className="group w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/35 hover:-translate-y-0.5"
              >
                <span className="font-display text-base">
                  {isAuthenticated ? `Apply for ${formatCurrency(amount)}` : 'Check My Eligibility'}
                </span>
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
              <p className="text-center text-navy-400 text-[11px] mt-3">No impact on your credit score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 animate-bounce opacity-30">
        <span className="text-white text-[9px] font-semibold uppercase tracking-[0.2em]">Scroll</span>
        <ChevronDown className="w-4 h-4 text-white" />
      </div>
    </section>
  );
}
