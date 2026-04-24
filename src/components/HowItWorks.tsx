import { ClipboardList, UserCheck, Banknote } from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: ClipboardList,
    title: 'Complete Your Application',
    desc: 'Fill in your personal, employment, and banking details in our quick 3-step form. It takes less than 5 minutes.',
  },
  {
    num: '02',
    icon: UserCheck,
    title: 'Get Your Decision',
    desc: 'Our team reviews your application promptly. We assess affordability responsibly in line with NCR guidelines.',
  },
  {
    num: '03',
    icon: Banknote,
    title: 'Receive Your Funds',
    desc: 'Once approved, funds are transferred directly to your bank account — often within the same business day.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#f8fafc] py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <span className="text-[#22c55e] text-sm font-semibold uppercase tracking-wider">Simple Process</span>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mt-2">How It Works</h2>
          <p className="text-gray-600 mt-3 max-w-lg mx-auto">Getting a loan with Philani Finance is straightforward and transparent.</p>
        </div>

        <div className="relative grid md:grid-cols-3 gap-8">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-gradient-to-r from-[#22c55e]/30 via-[#22c55e]/60 to-[#22c55e]/30" />

          {steps.map(({ num, icon: Icon, title, desc }) => (
            <div key={num} className="relative flex flex-col items-center text-center bg-white border border-gray-200 rounded-2xl p-8 hover:border-[#22c55e]/30 transition-colors duration-300 shadow-sm group">
              <div className="relative mb-5">
                <div className="w-20 h-20 rounded-2xl bg-[#f8fafc] border-2 border-[#22c55e]/40 group-hover:border-[#22c55e] flex items-center justify-center transition-colors duration-300">
                  <Icon className="w-8 h-8 text-[#22c55e]" />
                </div>
                <span className="absolute -top-2 -right-2 bg-[#22c55e] text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center">
                  {num.replace('0', '')}
                </span>
              </div>
              <h3 className="text-gray-900 font-bold text-lg mb-2">{title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
