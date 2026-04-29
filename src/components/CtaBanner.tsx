import { ArrowRight, Shield } from 'lucide-react';
import { useReveal } from '../lib/useReveal';

interface CtaBannerProps {
  isAuthenticated: boolean;
  onApply: () => void;
  onRequestAuth: () => void;
}

export default function CtaBanner({ isAuthenticated, onApply, onRequestAuth }: CtaBannerProps) {
  const ref = useReveal();

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-navy-900" />
      <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-brand-500/[0.07] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-blue-500/[0.05] blur-3xl" />
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <div ref={ref} className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="reveal">
          <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-full px-4 py-2 mb-8">
            <Shield className="w-4 h-4 text-brand-400" />
            <span className="text-brand-300 text-xs font-semibold tracking-wide">Trusted by South Africans</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6 tracking-tight">
            Ready to Get Started?<br />
            <span className="text-brand-400">It Takes Less Than 5 Minutes</span>
          </h2>

          <p className="text-navy-300 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Join thousands of South Africans who chose a faster, more dignified lending experience. No queues, no paper forms — just simple, secure, and transparent.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={isAuthenticated ? onApply : onRequestAuth}
              className="group bg-brand-500 hover:bg-brand-400 text-white font-bold px-8 py-4 rounded-2xl text-base flex items-center gap-3 transition-all duration-300 hover:shadow-2xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
            >
              <span className="font-display">
                {isAuthenticated ? 'Start Your Application' : 'Check My Eligibility'}
              </span>
              <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <span className="text-navy-500 text-sm">No impact on your credit score</span>
          </div>
        </div>
      </div>
    </section>
  );
}
