import { Zap, ShieldCheck, Lock, Clock } from 'lucide-react';

const items = [
  { icon: Zap, label: 'Fast Payout', desc: 'Funds within 24 hours of approval' },
  { icon: ShieldCheck, label: 'NCR Registered', desc: 'NCRCP0000 – Fully compliant lender' },
  { icon: Lock, label: 'Secure SSL', desc: '256-bit encryption on all data' },
  { icon: Clock, label: '5-Min Application', desc: 'Simple, fast, and hassle-free' },
];

export default function TrustBar() {
  return (
    <section className="bg-white border-y border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {items.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex flex-col items-center text-center gap-3 group">
              <div className="w-12 h-12 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center group-hover:bg-[#22c55e]/20 transition-colors duration-200">
                <Icon className="w-6 h-6 text-[#22c55e]" />
              </div>
              <div>
                <p className="text-gray-900 font-semibold text-sm">{label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
