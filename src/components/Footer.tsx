import { ArrowUpRight, Shield, Mail, Phone } from 'lucide-react';

function PFLogoLight() {
  return (
    <svg width="152" height="36" viewBox="0 0 152 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Philani Finance">
      <path d="M10 3L19 6.5V14C19 18.97 15.1 23.64 10 25C4.9 23.64 1 18.97 1 14V6.5L10 3Z" fill="#22c55e"/>
      <path d="M7 13L9.5 15.5L14 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="25" y="25" fontFamily="Poppins, system-ui, sans-serif" fontWeight="800" fontSize="18" fill="white" letterSpacing="-0.5">
        Philani
      </text>
      <text x="90" y="25" fontFamily="Poppins, system-ui, sans-serif" fontWeight="800" fontSize="18" fill="#22c55e" letterSpacing="-0.5">
        Finance
      </text>
    </svg>
  );
}

const navLinks   = [{ label: 'Why Us', href: '#why-us' }, { label: 'How It Works', href: '#how-it-works' }, { label: 'FAQ', href: '#faq' }];
const legalLinks = ['Privacy Policy', 'Terms & Conditions', 'PAIA Manual', 'Complaints Procedure'];

export default function Footer() {
  return (
    <footer className="bg-navy-950 text-navy-400">
      {/* Top gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-10">
        <div className="grid md:grid-cols-12 gap-10 mb-14">

          {/* Brand col */}
          <div className="md:col-span-4">
            <div className="mb-5">
              <PFLogoLight />
            </div>
            <p className="text-navy-400 text-sm leading-relaxed mb-6 max-w-xs">
              A responsible South African micro-lender committed to transparent, affordable, and fair credit for all.
            </p>
            {/* Contact */}
            <div className="space-y-2">
              <a href="mailto:info@philanifinance.co.za" className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors text-sm">
                <Mail className="w-4 h-4 text-brand-500" />
                info@philanifinance.co.za
              </a>
              <a href="tel:+27000000000" className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors text-sm">
                <Phone className="w-4 h-4 text-brand-500" />
                +27 (0) 00 000 0000
              </a>
            </div>
          </div>

          {/* Navigate */}
          <div className="md:col-span-2">
            <h4 className="text-white font-semibold text-xs uppercase tracking-[0.18em] mb-5">Navigate</h4>
            <ul className="space-y-3 text-sm">
              {navLinks.map(l => (
                <li key={l.label}>
                  <a href={l.href} className="text-navy-400 hover:text-white transition-colors duration-200 flex items-center gap-1 group">
                    {l.label}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-3">
            <h4 className="text-white font-semibold text-xs uppercase tracking-[0.18em] mb-5">Legal</h4>
            <ul className="space-y-3 text-sm">
              {legalLinks.map(item => (
                <li key={item}>
                  <a href="#" className="text-navy-400 hover:text-white transition-colors duration-200">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Compliance */}
          <div className="md:col-span-3">
            <h4 className="text-white font-semibold text-xs uppercase tracking-[0.18em] mb-5">Compliance</h4>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-500 flex-shrink-0" />
                <span>NCR Reg: <span className="text-navy-200 font-mono text-xs">NCRCP0000</span></span>
              </div>
              <p>NCA Compliant Lender</p>
              <p>POPIA Compliant</p>
            </div>
            <div className="mt-5 pt-5 border-t border-navy-800/60">
              <p className="text-xs leading-relaxed text-navy-500">
                Registered under the National Credit Act, 34 of 2005.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-navy-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-navy-600">&copy; {new Date().getFullYear()} Philani Finance (Pty) Ltd. All rights reserved.</p>
          <p className="text-xs text-navy-700 text-center sm:text-right max-w-md leading-relaxed">
            ⚠ Warning: Borrowing money is expensive. Please borrow only what you can afford to repay.
          </p>
        </div>
      </div>
    </footer>
  );
}
