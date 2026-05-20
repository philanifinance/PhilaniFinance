import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useReveal } from '../lib/useReveal';

// High-res Unsplash — aspirational success / South African professional
const CTA_IMAGE = 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&auto=format&fit=crop&q=90';

interface CtaBannerProps {
  isAuthenticated: boolean;
  onApply: () => void;
  onRequestAuth: () => void;
}

export default function CtaBanner({ isAuthenticated, onApply, onRequestAuth }: CtaBannerProps) {
  const ref = useReveal();

  return (
    <section className="relative overflow-hidden bg-navy-950">
      {/* Full-bleed photo with overlay */}
      <div className="absolute inset-0">
        <img
          src={CTA_IMAGE}
          alt=""
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-950/80 to-navy-950/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-transparent" />
      </div>

      <div ref={ref} className="relative max-w-6xl mx-auto px-4 sm:px-6 py-32">
        <div className="max-w-xl reveal">

          {/* Compliance badge */}
          <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] backdrop-blur-sm rounded-full px-4 py-2 mb-8">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            <span className="text-white/70 text-xs font-medium tracking-wide">NCR Registered · NCA Compliant</span>
          </div>

          <h2 className="font-display font-extrabold text-white leading-[1.06] tracking-tight mb-6"
              style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)' }}>
            Ready to Take Control<br />
            of Your <span className="gradient-text">Finances?</span>
          </h2>

          <p className="text-white/60 text-lg leading-relaxed mb-10">
            Join thousands of South Africans who chose a faster, more dignified lending experience.
            Fully digital. Fully transparent. No queues.
          </p>

          <div className="flex flex-col sm:flex-row items-start gap-4">
            <button
              onClick={isAuthenticated ? onApply : onRequestAuth}
              className="group bg-brand-500 hover:bg-brand-400 text-white font-bold px-8 py-4 rounded-2xl text-base flex items-center gap-3 transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
            >
              <span className="font-display">
                {isAuthenticated ? 'Start My Application' : 'Check My Eligibility'}
              </span>
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <span className="text-white/30 text-sm self-center">No impact on your credit score</span>
          </div>
        </div>
      </div>
    </section>
  );
}
