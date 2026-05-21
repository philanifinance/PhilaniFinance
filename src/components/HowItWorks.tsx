import { UserPlus, ScanLine, CheckCircle, Banknote } from 'lucide-react';
import { useReveal } from '../lib/useReveal';

// High-res Unsplash — person using phone for banking / fintech
const PROCESS_IMAGE = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&auto=format&fit=crop&q=90';

const steps = [
  {
    num: 1,
    icon: UserPlus,
    title: 'Create Your Profile',
    desc: 'Sign up in under a minute. Your data is encrypted end-to-end from the first keystroke.',
    time: '< 1 min',
    accent: '#fc5107',
  },
  {
    num: 2,
    icon: ScanLine,
    title: 'Verify Your Income',
    desc: 'Upload your payslip and bank statements digitally. No queues, no branches, no paper.',
    time: '< 3 min',
    accent: '#3b82f6',
  },
  {
    num: 3,
    icon: CheckCircle,
    title: 'Receive Your Offer',
    desc: 'We assess your application and send a personalised offer with full transparency on costs.',
    time: 'Same day',
    accent: '#8b5cf6',
  },
  {
    num: 4,
    icon: Banknote,
    title: 'Funds in Your Account',
    desc: 'Accept, sign digitally, approve the debit mandate — money lands in your account.',
    time: 'Same day',
    accent: '#f59e0b',
  },
];

export default function HowItWorks() {
  const sectionRef = useReveal();

  return (
    <section id="how-it-works" className="relative bg-slate-50 py-28 overflow-hidden">
      <div ref={sectionRef} className="relative max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-20 reveal">
          <span className="inline-block text-brand-600 text-xs font-bold uppercase tracking-[0.2em] mb-3">Simple Process</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            Application to Funds in{' '}
            <span className="gradient-text">4 Steps</span>
          </h2>
          <p className="text-navy-500 mt-4 max-w-lg mx-auto leading-relaxed">
            The entire journey is digital, fast, and completely transparent.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">

          {/* Steps */}
          <div className="space-y-5">
            {steps.map(({ num, icon: Icon, title, desc, time, accent }, idx) => (
              <div key={num} className={`reveal delay-${idx * 100} group flex gap-5 items-start`}>
                {/* Icon column */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300"
                       style={{ backgroundColor: `${accent}18` }}>
                    <Icon className="w-5 h-5" style={{ color: accent }} />
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="w-px h-6 mt-1.5" style={{ background: `linear-gradient(to bottom, ${accent}40, transparent)` }} />
                  )}
                </div>

                {/* Card */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-100 px-5 py-4 group-hover:border-slate-200 group-hover:shadow-md transition-all duration-300">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-display text-navy-900 font-bold text-sm">{title}</h3>
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white flex-shrink-0"
                          style={{ backgroundColor: accent }}>
                      {time}
                    </span>
                  </div>
                  <p className="text-navy-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Photo */}
          <div className="reveal-right relative">
            <div className="relative rounded-3xl overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.14)] aspect-[3/4]">
              <img
                src={PROCESS_IMAGE}
                alt="Digital finance on mobile"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 via-transparent to-transparent" />
              {/* Floating pill at bottom */}
              <div className="absolute bottom-6 left-6 right-6">
                <div className="bg-white/90 backdrop-blur-xl rounded-2xl px-5 py-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-navy-900 font-black text-xl font-display">~15 min</p>
                      <p className="text-navy-500 text-xs mt-0.5">Average application time</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center animate-float">
                      <Banknote className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
