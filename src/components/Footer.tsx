import { Shield } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid md:grid-cols-3 gap-10 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-[#22c55e] rounded-lg p-1.5">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-900 font-bold text-lg">
                Philani<span className="text-[#22c55e]">Finance</span>
              </span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              A responsible South African micro-lender committed to transparent, affordable, and fair credit for all.
            </p>
          </div>

          <div>
            <h4 className="text-gray-900 font-semibold text-sm mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#how-it-works" className="hover:text-gray-900 transition-colors">How It Works</a></li>
              <li><a href="#apply" className="hover:text-gray-900 transition-colors">Apply Now</a></li>
              <li><a href="#faq" className="hover:text-gray-900 transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-gray-900 transition-colors">Terms & Conditions</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-gray-900 font-semibold text-sm mb-4">Compliance</h4>
            <div className="space-y-2 text-sm text-gray-500">
              <p>NCR Registration: <span className="text-gray-700 font-mono">NCRCP0000</span></p>
              <p>NCA Compliant Lender</p>
              <p>POPIA Compliant</p>
              <p className="pt-2 border-t border-gray-200">
                Registered under the National Credit Act, 34 of 2005. We conduct affordability assessments on all applications.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} Philani Finance (Pty) Ltd. All rights reserved.</p>
          <p className="text-center sm:text-right max-w-md">
            Warning: Borrowing money is expensive. Please borrow only what you can afford to repay. NCR Reg. NCRCP0000.
          </p>
        </div>
      </div>
    </footer>
  );
}
