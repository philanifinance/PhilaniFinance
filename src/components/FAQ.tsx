import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

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

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-[#f8fafc] py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-[#22c55e] text-sm font-semibold uppercase tracking-wider">Got Questions?</span>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((item, idx) => (
            <div
              key={idx}
              className={`border rounded-xl overflow-hidden transition-all duration-300 shadow-sm ${open === idx ? 'border-[#22c55e]/40 bg-white' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
                onClick={() => setOpen(open === idx ? null : idx)}
              >
                <span className="text-gray-900 font-semibold text-sm leading-snug">{item.q}</span>
                <ChevronDown className={`w-5 h-5 text-[#22c55e] flex-shrink-0 transition-transform duration-300 ${open === idx ? 'rotate-180' : ''}`} />
              </button>
              {open === idx && (
                <div className="px-6 pb-5">
                  <p className="text-gray-600 text-sm leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
