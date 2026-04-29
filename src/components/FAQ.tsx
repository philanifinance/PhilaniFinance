import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useReveal } from '../lib/useReveal';

const faqs = [
  {
    q: 'How long does it take to get a decision?',
    a: 'Applications are typically reviewed within a few hours during business hours. Once approved, funds are transferred within the same business day.',
  },
  {
    q: 'What are the requirements to qualify?',
    a: 'You must be a South African citizen or permanent resident with a valid SA ID, be 18 years or older, have a regular income, and hold an active South African bank account.',
  },
  {
    q: 'What is the maximum loan amount?',
    a: 'We offer micro-loans from R500 up to R8,000. Your approved amount is based on a responsible affordability assessment.',
  },
  {
    q: 'How is the interest rate calculated?',
    a: 'We charge 0.15% per day on the outstanding principal. A once-off service fee of R60 plus 10% of the loan amount applies, with VAT at 15% on all fees.',
  },
  {
    q: 'Is my personal information safe?',
    a: 'Absolutely. All data is encrypted with 256-bit SSL. We never share or sell your personal information to third parties.',
  },
  {
    q: 'Can I repay early?',
    a: 'Yes. Early settlement is always welcome. If you repay before your due date, only interest for the actual days used will apply — no penalty fees.',
  },
  {
    q: 'What if I cannot repay on time?',
    a: 'Please contact us immediately. We believe in responsible lending and will work with you to find a solution. Ignoring a missed payment may result in additional fees.',
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: typeof faqs[number]; isOpen: boolean; onToggle: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen]);

  return (
    <div className={`rounded-2xl border transition-all duration-300 ${isOpen ? 'border-brand-200 bg-white shadow-md shadow-brand-500/[0.06]' : 'border-gray-100 bg-white hover:border-gray-200 shadow-sm'}`}>
      <button
        className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
        onClick={onToggle}
      >
        <span className={`font-display font-semibold text-sm leading-snug transition-colors duration-200 ${isOpen ? 'text-brand-700' : 'text-navy-800'}`}>
          {item.q}
        </span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isOpen ? 'bg-brand-500 rotate-180' : 'bg-navy-50'}`}>
          <ChevronDown className={`w-4 h-4 transition-colors duration-200 ${isOpen ? 'text-white' : 'text-navy-500'}`} />
        </div>
      </button>
      <div
        style={{ maxHeight: height }}
        className="overflow-hidden transition-all duration-300 ease-out"
      >
        <div ref={contentRef} className="px-6 pb-5">
          <p className="text-navy-500 text-sm leading-relaxed">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const sectionRef = useReveal();

  return (
    <section id="faq" className="bg-gradient-to-b from-white to-slate-50 py-24">
      <div ref={sectionRef} className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14 reveal">
          <span className="inline-block text-brand-600 text-xs font-bold uppercase tracking-[0.2em] mb-3">Got Questions?</span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-navy-500 mt-4 max-w-lg mx-auto leading-relaxed">
            Everything you need to know about borrowing with Philani Finance.
          </p>
        </div>

        <div className="space-y-3 reveal delay-200">
          {faqs.map((item, idx) => (
            <AccordionItem
              key={idx}
              item={item}
              isOpen={open === idx}
              onToggle={() => setOpen(open === idx ? null : idx)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
