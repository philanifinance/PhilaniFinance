import { UserPlus, ScanLine, CheckCircle, ShieldCheck } from 'lucide-react';
import { useReveal } from '../lib/useReveal';

const steps = [
  {
    num: 1,
    icon: UserPlus,
    title: 'Create Your Profile',
    desc: 'Sign up securely in under a minute. Your data is encrypted and protected.',
  },
  {
    num: 2,
    icon: ScanLine,
    title: 'Digital Income Verification',
    desc: 'Link your bank instantly or upload statements. No queues, no paper forms.',
  },
  {
    num: 3,
    icon: CheckCircle,
    title: 'Instant Decision',
    desc: 'Get a transparent offer with clear terms. Accept it on your own terms.',
  },
  {
    num: 4,
    icon: ShieldCheck,
    title: 'Secure Repayment Setup',
    desc: 'Automated, safe repayment linked to your bank. One less thing to worry about.',
  },
];

export default function HowItWorks() {
  const sectionRef = useReveal();

  return (
    <section id="how-it-works" className="relative bg-gradient-to-b from-slate-50 to-white py-24 overflow-hidden">
      <div ref={sectionRef} className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16 reveal">
          <span className="inline-block text-brand-600 text-xs font-bold uppercase tracking-[0.2em] mb-3">Simple Process</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            Four Steps to Your Funds
          </h2>
          <p className="text-navy-500 mt-4 max-w-lg mx-auto leading-relaxed">
            From sign-up to funds in your account — the entire process is digital, fast, and transparent.
          </p>
        </div>

        <div className="relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-12 left-[calc(12.5%+28px)] right-[calc(12.5%+28px)] h-px">
            <div className="h-full bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 rounded-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {steps.map(({ num, icon: Icon, title, desc }, idx) => (
              <div key={num} className={`reveal delay-${(idx + 1) * 100} relative flex flex-col items-center text-center group`}>
                {/* Step circle */}
                <div className="relative z-10 mb-5">
                  <div className="w-24 h-24 rounded-3xl bg-white border-2 border-gray-100 group-hover:border-brand-300 flex items-center justify-center transition-all duration-500 shadow-lg shadow-navy-900/[0.04] group-hover:shadow-xl group-hover:shadow-brand-500/[0.08] group-hover:-translate-y-1">
                    <Icon className="w-9 h-9 text-navy-600 group-hover:text-brand-600 transition-colors duration-300" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center shadow-md shadow-brand-500/30 font-display">
                    {num}
                  </span>
                </div>

                <h3 className="font-display text-navy-900 font-bold text-base mb-2">{title}</h3>
                <p className="text-navy-500 text-sm leading-relaxed max-w-[200px]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
