import { ArrowUpRight, Shield, Mail, Phone } from 'lucide-react';

function PFLogoLight() {
  return <img src="/pfsl-f.png" alt="Philani Finance" className="h-20 w-auto brightness-0 invert" />;
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
            <p className="text-navy-400 text-sm leading-relaxed mb-4 max-w-xs">
              A responsible South African micro-lender committed to transparent, affordable, and fair credit for all.
            </p>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] flex items-center gap-2 mb-6">
              <span className="h-px w-5 bg-brand-500/40 flex-shrink-0" />
              <span className="text-navy-500">Pay Day Too Far</span>
              <span className="text-brand-500 mx-0.5">·</span>
              <span className="text-brand-400">We Got You</span>
            </p>
            {/* Contact */}
            <div className="space-y-2">
              <a href="mailto:info@philanifinance.co.za" className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors text-sm">
                <Mail className="w-4 h-4 text-brand-500" />
                info@philanifinance.co.za
              </a>
              <a href="tel:+27137522478" className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors text-sm">
                <Phone className="w-4 h-4 text-brand-500" />
                013 752 2478
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
                <span>NCR Reg: <span className="text-navy-200 font-mono text-xs">NCRCP18260</span></span>
              </div>
              <p className="text-xs text-navy-500 leading-relaxed">3663 Mtshilibe Street,<br/>Ratanda, Heidelberg, 1441</p>
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
          <p className="text-xs text-navy-600">&copy; {new Date().getFullYear()} Philani Financial Services. All rights reserved.</p>
          <p className="text-xs text-navy-700 text-center sm:text-right max-w-md leading-relaxed">
            ⚠ Warning: Borrowing money is expensive. Please borrow only what you can afford to repay.
          </p>
        </div>
      </div>
    </footer>
  );
}
