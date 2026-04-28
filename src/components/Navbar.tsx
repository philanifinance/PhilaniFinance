import { Menu, X, LogOut, User, LogIn } from 'lucide-react';
import { useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface NavbarProps {
  user: SupabaseUser | null;
  onSignOut: () => void;
  onSignIn: () => void;
  onApply: () => void;
  onHome: () => void;
  onAdmin: () => void;
  onDashboard: () => void;
  currentPage: 'home' | 'apply' | 'admin' | 'dashboard' | 'forbidden';
  isAdmin: boolean;
}

export default function Navbar({ user, onSignOut, onSignIn, onApply, onHome, onAdmin, onDashboard, currentPage, isAdmin }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <button onClick={onHome} className="flex items-center gap-2">
            <img
              src="/PF_logo.svg"
              alt="Philani Finance"
              className="h-16 w-auto"
            />
          </button>

          <div className="hidden md:flex items-center gap-8">
            {currentPage === 'home' && (
              <>
                <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">How It Works</a>
                <a href="#faq" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">FAQ</a>
              </>
            )}
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-gray-700 text-sm flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#22c55e]" />
                  {user.email?.split('@')[0]}
                </span>
                {currentPage === 'home' && (
                  <button
                    onClick={onApply}
                    className="bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-green-500/25"
                  >
                    Apply Now
                  </button>
                )}
                {isAdmin ? (
                  <button
                    onClick={onAdmin}
                    className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${currentPage === 'admin' ? 'text-[#22c55e]' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Admin
                  </button>
                ) : (
                  <button
                    onClick={onDashboard}
                    className={`text-sm font-medium transition-colors flex items-center gap-1.5 ${currentPage === 'dashboard' ? 'text-[#22c55e]' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    My Account
                  </button>
                )}
                <button
                  onClick={onSignOut}
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={currentPage === 'apply' ? onSignIn : onApply}
                className="bg-[#22c55e] hover:bg-[#16a34a] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-green-500/25 flex items-center gap-2"
              >
                {currentPage === 'apply' ? <><LogIn className="w-4 h-4" /> Sign In</> : 'Apply Now'}
              </button>
            )}
          </div>

          <button className="md:hidden text-gray-600" onClick={() => setOpen(!open)}>
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden border-t border-gray-200 py-4 flex flex-col gap-4 bg-white">
            {currentPage === 'home' && (
              <>
                <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3" onClick={() => setOpen(false)}>How It Works</a>
                <a href="#faq" className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3" onClick={() => setOpen(false)}>FAQ</a>
              </>
            )}
            {user ? (
              <>
                <span className="text-gray-700 text-sm flex items-center gap-1.5 px-3">
                  <User className="w-4 h-4 text-[#22c55e]" />
                  {user.email}
                </span>
                {currentPage === 'home' && (
                  <button
                    onClick={() => { onApply(); setOpen(false); }}
                    className="bg-[#22c55e] text-white text-sm font-semibold px-5 py-2.5 rounded-lg text-center"
                  >
                    Apply Now
                  </button>
                )}
                {isAdmin ? (
                  <button
                    onClick={() => { onAdmin(); setOpen(false); }}
                    className={`text-sm font-medium px-3 flex items-center gap-1.5 text-left ${currentPage === 'admin' ? 'text-[#22c55e]' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Admin
                  </button>
                ) : (
                  <button
                    onClick={() => { onDashboard(); setOpen(false); }}
                    className={`text-sm font-medium px-3 flex items-center gap-1.5 text-left ${currentPage === 'dashboard' ? 'text-[#22c55e]' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    My Account
                  </button>
                )}
                <button
                  onClick={() => { onSignOut(); setOpen(false); }}
                  className="text-gray-600 hover:text-gray-900 text-sm font-medium px-3 flex items-center gap-1.5 text-left"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => { (currentPage === 'apply' ? onSignIn : onApply)(); setOpen(false); }}
                className="bg-[#22c55e] text-white text-sm font-semibold px-5 py-2.5 rounded-lg text-center flex items-center justify-center gap-2"
              >
                {currentPage === 'apply' ? <><LogIn className="w-4 h-4" /> Sign In</> : 'Apply Now'}
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
