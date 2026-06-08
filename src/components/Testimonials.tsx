import { Star, Quote } from 'lucide-react';
import { useReveal } from '../lib/useReveal';

const testimonials = [
  {
    name: 'Rease Mohamed',
    rating: 5,
    text: 'The site is easy to understand, making the loan process seamless.',
  },
  {
    name: 'Yashin Naidu',
    rating: 5,
    text: 'Money was paid into my account within 24 hours.',
  },
  {
    name: 'Anonymous',
    rating: 5,
    text: 'They update you on each and every step of your loan process.',
  },
  {
    name: 'Thabiso Ngubo',
    rating: 5,
    text: 'What you sign for is what you get, no hidden agendas and surprises.',
  },
  {
    name: 'Cindy Zulu',
    rating: 5,
    text: 'Professional and prompt responses.',
  },
];

function initials(name: string) {
  if (name.toLowerCase() === 'anonymous') return 'A';
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function Testimonials() {
  const sectionRef = useReveal();

  return (
    <section className="relative bg-navy-950 py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.05),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

      <div ref={sectionRef} className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-16 reveal">
          <span className="inline-block text-brand-400 text-xs font-bold uppercase tracking-[0.2em] mb-3">Real People</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            What Our Clients{' '}
            <span className="gradient-text">Say About Us</span>
          </h2>
          <p className="text-navy-400 mt-4 max-w-xl mx-auto leading-relaxed">
            Over 2,400 South Africans have trusted Philani Finance for fast, fair, and transparent lending.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {testimonials.map(({ name, rating, text }, idx) => (
            <div
              key={name}
              className={`reveal delay-${(idx % 3) * 150 + 100} group relative glass-dark rounded-2xl p-6 flex flex-col hover:border-white/[0.12] transition-all duration-500 hover:shadow-2xl hover:shadow-brand-500/[0.08] hover:-translate-y-1`}
            >
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-brand-500/30 mb-4" />

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>

              {/* Text */}
              <p className="text-navy-300 text-sm leading-relaxed mb-5 flex-1">"{text}"</p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <div className="w-10 h-10 rounded-full bg-brand-500/15 border-2 border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-sm">
                  {initials(name)}
                </div>
                <p className="text-white font-semibold text-sm">{name}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom trust line */}
        <div className="mt-14 text-center reveal delay-300">
          <div className="inline-flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-full px-6 py-3">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <span className="text-navy-300 text-sm">
              <strong className="text-white">2,400+</strong> happy clients and counting
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
