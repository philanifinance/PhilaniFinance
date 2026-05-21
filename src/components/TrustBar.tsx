import { Zap, Eye, Users } from 'lucide-react';
import { useReveal } from '../lib/useReveal';
import { useEffect, useRef, useState } from 'react';

const stats = [
  { value: 2400, suffix: '+', label: 'Clients Served' },
  { value: 98,   suffix: '%', label: 'Approval Rate' },
  { value: 4,    suffix: 'h', label: 'Avg. Payout Time' },
  { value: 100,  suffix: '%', label: 'NCR Registered' },
];

const benefits = [
  {
    icon: Zap,
    title: 'Instant Verification',
    desc: 'Skip the queues entirely. Upload your documents digitally — verified in seconds, not days.',
    accent: '#22c55e',
  },
  {
    icon: Eye,
    title: 'Zero Hidden Fees',
    desc: 'See the exact total cost before you click Apply. Transparent pricing, no surprises at month-end.',
    accent: '#3b82f6',
  },
  {
    icon: Users,
    title: 'Built for Real People',
    desc: 'Your details are saved securely. Return clients get a decision in under 60 seconds — every time.',
    accent: '#8b5cf6',
  },
];

// High-res Unsplash — modern financial district / aspirational South African scene
const FEATURE_IMAGE = 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=90';

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const steps = 60;
        const step = target / steps;
        let cur = 0;
        const timer = setInterval(() => {
          cur = Math.min(cur + step, target);
          setCount(Math.round(cur));
          if (cur >= target) clearInterval(timer);
        }, 1600 / steps);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

export default function TrustBar() {
  const sectionRef = useReveal();

  return (
    <>
      {/* ── Stats strip ─────────────────────────────────── */}
      <div className="bg-navy-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-x divide-navy-800/40">
            {stats.map((s, i) => (
              <div key={s.label} className={`text-center ${i === 0 ? '' : 'px-4'}`}>
                <div className="font-display text-3xl sm:text-4xl font-black gradient-text tabular-nums leading-none mb-2">
                  <AnimatedCounter target={s.value} suffix={s.suffix} />
                </div>
                <p className="text-navy-500 text-xs font-medium uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Why Us ──────────────────────────────────────── */}
      <section id="why-us" className="relative bg-white py-28 overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-500/[0.025] rounded-full blur-3xl pointer-events-none" />

        <div ref={sectionRef} className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">

            {/* Left — photo */}
            <div className="reveal-left order-2 lg:order-1">
              <div className="relative rounded-3xl overflow-hidden aspect-[4/5] shadow-[0_40px_100px_rgba(0,0,0,0.12)]">
                <img
                  src={FEATURE_IMAGE}
                  alt="Modern financial district"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-navy-950/10 to-transparent" />
                {/* Floating stat */}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="bg-white/90 backdrop-blur-xl rounded-2xl px-5 py-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-navy-900 font-black text-2xl font-display">100%</p>
                        <p className="text-navy-500 text-xs font-medium mt-0.5">Digital — zero branch visits</p>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — copy + cards */}
            <div className="order-1 lg:order-2 space-y-10">
              <div className="reveal">
                <span className="inline-block text-brand-600 text-xs font-bold uppercase tracking-[0.2em] mb-3">Why Choose Us</span>
                <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-navy-900 leading-tight tracking-tight">
                  Built Around <span className="gradient-text">You</span>
                </h2>
                <p className="text-navy-500 mt-4 leading-relaxed max-w-md">
                  A lending experience that respects your time, your privacy, and your intelligence.
                </p>
              </div>

              <div className="space-y-4">
                {benefits.map(({ icon: Icon, title, desc, accent }, idx) => (
                  <div key={title} className={`reveal delay-${(idx + 1) * 150} group flex gap-5 items-start p-5 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-lg transition-all duration-400 bg-white hover:-translate-y-0.5`}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                         style={{ backgroundColor: `${accent}15` }}>
                      <Icon className="w-5 h-5" style={{ color: accent }} />
                    </div>
                    <div>
                      <h3 className="font-display text-navy-900 font-bold text-sm mb-1">{title}</h3>
                      <p className="text-navy-500 text-sm leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
