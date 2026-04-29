import { Shield, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-navy-950 text-navy-300">
      {/* Main footer content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-10">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="bg-brand-500 rounded-xl p-2">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-display text-white font-bold text-lg tracking-tight">
                Philani<span className="text-brand-400">Finance</span>
              </span>
            </div>
            <p className="text-navy-400 text-sm leading-relaxed">
              A responsible South African micro-lender committed to transparent, affordable, and fair credit for all.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-display font-semibold text-xs uppercase tracking-[0.15em] mb-5">Navigate</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'Why Us', href: '#why-us' },
                { label: 'How It Works', href: '#how-it-works' },
                { label: 'FAQ', href: '#faq' },
                { label: 'Apply Now', href: '#apply' },
              ].map(link => (
                <li key={link.label}>
                  <a href={link.href} className="text-navy-400 hover:text-white transition-colors duration-200 flex items-center gap-1 group">
                    {link.label}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-display font-semibold text-xs uppercase tracking-[0.15em] mb-5">Legal</h4>
            <ul className="space-y-3 text-sm">
              {['Privacy Policy', 'Terms & Conditions', 'PAIA Manual', 'Complaints Procedure'].map(item => (
                <li key={item}>
                  <a href="#" className="text-navy-400 hover:text-white transition-colors duration-200">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Compliance */}
          <div>
            <h4 className="text-white font-display font-semibold text-xs uppercase tracking-[0.15em] mb-5">Compliance</h4>
            <div className="space-y-3 text-sm text-navy-400">
              <p>NCR Registration: <span className="text-navy-200 font-mono text-xs">NCRCP0000</span></p>
              <p>NCA Compliant Lender</p>
              <p>POPIA Compliant</p>
              <div className="mt-4 pt-4 border-t border-navy-800/60">
                <p className="text-xs leading-relaxed text-navy-500">
                  Registered under the National Credit Act, 34 of 2005. All applications subject to affordability assessments.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-navy-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-navy-500">&copy; {new Date().getFullYear()} Philani Finance (Pty) Ltd. All rights reserved.</p>
          <p className="text-xs text-navy-600 text-center sm:text-right max-w-md leading-relaxed">
            Warning: Borrowing money is expensive. Please borrow only what you can afford to repay.
          </p>
        </div>
      </div>
    </footer>
  );
}
