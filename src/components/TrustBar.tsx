import { Zap, Eye, Users } from 'lucide-react';
import { useReveal } from '../lib/useReveal';

const benefits = [
  {
    icon: Zap,
    title: 'Instant Verification',
    desc: 'Skip the queues. Link your income details securely in seconds — no paperwork, no waiting rooms.',
    accent: 'from-brand-500 to-emerald-500',
    bg: 'bg-brand-50',
  },
  {
    icon: Eye,
    title: 'No Hidden Fees',
    desc: 'You\'ll know the exact cost before you accept. Transparent terms, honest pricing, zero surprises.',
    accent: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-50',
  },
  {
    icon: Users,
    title: 'Built for Return Clients',
    desc: 'We save your data securely. Your second application takes less than 60 seconds — even faster.',
    accent: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-50',
  },
];

export default function TrustBar() {
  const sectionRef = useReveal();

  return (
    <section id="why-us" className="relative bg-white py-24 overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div ref={sectionRef} className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16 reveal">
          <span className="inline-block text-brand-600 text-xs font-bold uppercase tracking-[0.2em] mb-3">Why Choose Us</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            Speed & Freedom,<br className="sm:hidden" /> Without Compromise
          </h2>
          <p className="text-navy-500 mt-4 max-w-xl mx-auto leading-relaxed">
            We built a lending experience that respects your time, your privacy, and your intelligence.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {benefits.map(({ icon: Icon, title, desc, accent, bg }, idx) => (
            <div key={title} className={`reveal delay-${(idx + 1) * 200} group relative bg-white rounded-2xl p-8 border border-gray-100 hover:border-gray-200 transition-all duration-500 hover:shadow-xl hover:shadow-navy-900/[0.06] hover:-translate-y-1`}>
              {/* Gradient bar top */}
              <div className={`absolute top-0 left-8 right-8 h-1 rounded-b-full bg-gradient-to-r ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

              <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-7 h-7 text-navy-700" />
              </div>
              <h3 className="font-display text-navy-900 font-bold text-lg mb-3">{title}</h3>
              <p className="text-navy-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
