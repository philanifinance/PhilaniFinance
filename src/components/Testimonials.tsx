import { Star, Quote } from 'lucide-react';
import { useReveal } from '../lib/useReveal';

const testimonials = [
  {
    name: 'Thandi M.',
    location: 'Johannesburg',
    photo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&auto=format&fit=crop&q=80',
    rating: 5,
    text: 'I needed money urgently for a car repair and had it in my account the same afternoon. The whole process was done on my phone — no queues, no stress.',
    loan: 'R 3,500 loan',
  },
  {
    name: 'Sipho K.',
    location: 'Durban',
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&auto=format&fit=crop&q=80',
    rating: 5,
    text: "Transparent from start to finish. I could see exactly what I'd owe before clicking 'Apply'. No hidden fees, no surprises at the end of the month.",
    loan: 'R 5,000 loan',
  },
  {
    name: 'Naledi D.',
    location: 'Pretoria',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&auto=format&fit=crop&q=80',
    rating: 5,
    text: 'My second loan was approved in less than an hour. They remembered all my details. Honestly the best micro-lender I have ever used.',
    loan: 'R 2,000 loan',
  },
  {
    name: 'Luyanda N.',
    location: 'Cape Town',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&auto=format&fit=crop&q=80',
    rating: 5,
    text: "School fees were due and I was short. Philani Finance came through for me within the same day. The repayment was exactly what they quoted — not a cent more.",
    loan: 'R 1,500 loan',
  },
  {
    name: 'Zanele P.',
    location: 'East London',
    photo: 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=120&h=120&auto=format&fit=crop&q=80',
    rating: 5,
    text: "I was nervous about applying online but the process was so smooth. Everything was explained clearly and my loan was approved faster than I expected.",
    loan: 'R 4,000 loan',
  },
  {
    name: 'Mpho R.',
    location: 'Bloemfontein',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&auto=format&fit=crop&q=80',
    rating: 5,
    text: 'Real people, real service. When I had a question the support team responded quickly. I have recommended Philani Finance to all my colleagues.',
    loan: 'R 6,000 loan',
  },
];

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
          {testimonials.map(({ name, location, photo, rating, text, loan }, idx) => (
            <div
              key={name}
              className={`reveal delay-${(idx % 3) * 150 + 100} group relative glass-dark rounded-2xl p-6 hover:border-white/[0.12] transition-all duration-500 hover:shadow-2xl hover:shadow-brand-500/[0.08] hover:-translate-y-1`}
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

              {/* Loan tag */}
              <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-full px-3 py-1 mb-5">
                {loan}
              </span>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <img
                  src={photo}
                  alt={name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-brand-500/30"
                />
                <div>
                  <p className="text-white font-semibold text-sm">{name}</p>
                  <p className="text-navy-400 text-xs">{location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom trust line */}
        <div className="mt-14 text-center reveal delay-300">
          <div className="inline-flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-full px-6 py-3">
            <div className="flex -space-x-2">
              {testimonials.slice(0, 4).map(t => (
                <img key={t.name} src={t.photo} alt={t.name} className="w-7 h-7 rounded-full border-2 border-navy-950 object-cover" />
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
