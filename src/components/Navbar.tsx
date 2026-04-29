import { Menu, X, LogOut, User, LogIn, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLink = (active: boolean) =>
    `relative text-sm font-medium transition-colors duration-200 ${active ? 'text-brand-600' : 'text-navy-600 hover:text-navy-900'} after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:bg-brand-500 after:transition-all after:duration-300 ${active ? 'after:w-full' : 'after:w-0 hover:after:w-full'}`;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-xl shadow-lg shadow-navy-900/5 border-b border-gray-200/60' : 'bg-white/70 backdrop-blur-md border-b border-transparent'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <button onClick={onHome} className="flex items-center gap-2 group">
            <img src="/PF_logo.svg" alt="Philani Finance" className="h-14 w-auto transition-transform duration-200 group-hover:scale-105" />
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {currentPage === 'home' && (
              <>
                <a href="#why-us" className={navLink(false)}>Why Us</a>
                <a href="#how-it-works" className={navLink(false)}>How It Works</a>
                <a href="#faq" className={navLink(false)}>FAQ</a>
              </>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-navy-50 rounded-full pl-2 pr-3 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-brand-500/10 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-brand-600" />
                  </div>
                  <span className="text-navy-700 text-xs font-medium">{user.email?.split('@')[0]}</span>
                </div>
                {currentPage === 'home' && (
                  <button onClick={onApply}
                    className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-px flex items-center gap-1.5">
                    Apply Now <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {isAdmin ? (
                  <button onClick={onAdmin} className={navLink(currentPage === 'admin')}>Admin</button>
                ) : (
                  <button onClick={onDashboard} className={navLink(currentPage === 'dashboard')}>My Account</button>
                )}
                <button onClick={onSignOut}
                  className="text-navy-400 hover:text-navy-700 text-sm font-medium transition-colors flex items-center gap-1.5 ml-1">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {currentPage === 'apply' ? (
                  <button onClick={onSignIn}
                    className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-px flex items-center gap-2">
                    <LogIn className="w-4 h-4" /> Sign In
                  </button>
                ) : (
                  <>
                    <button onClick={onSignIn}
                      className="text-navy-600 hover:text-navy-900 text-sm font-medium transition-colors">
                      Sign In
                    </button>
                    <button onClick={onApply}
                      className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-px flex items-center gap-1.5">
                      Get Started <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-navy-50 transition-colors text-navy-700"
            onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${open ? 'max-h-96 pb-6' : 'max-h-0'}`}>
          <div className="pt-2 flex flex-col gap-1">
            {currentPage === 'home' && (
              <>
                <a href="#why-us" onClick={() => setOpen(false)} className="text-navy-600 hover:text-navy-900 hover:bg-navy-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">Why Us</a>
                <a href="#how-it-works" onClick={() => setOpen(false)} className="text-navy-600 hover:text-navy-900 hover:bg-navy-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">How It Works</a>
                <a href="#faq" onClick={() => setOpen(false)} className="text-navy-600 hover:text-navy-900 hover:bg-navy-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">FAQ</a>
              </>
            )}
            {user ? (
              <>
                <div className="flex items-center gap-2 px-4 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-brand-500/10 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-brand-600" />
                  </div>
                  <span className="text-navy-700 text-sm font-medium">{user.email}</span>
                </div>
                {currentPage === 'home' && (
                  <button onClick={() => { onApply(); setOpen(false); }}
                    className="mx-4 bg-brand-500 text-white text-sm font-semibold px-5 py-3 rounded-xl text-center">
                    Apply Now
                  </button>
                )}
                {isAdmin ? (
                  <button onClick={() => { onAdmin(); setOpen(false); }}
                    className={`text-sm font-medium px-4 py-2.5 rounded-xl text-left transition-colors ${currentPage === 'admin' ? 'text-brand-600 bg-brand-50' : 'text-navy-600 hover:bg-navy-50'}`}>
                    Admin
                  </button>
                ) : (
                  <button onClick={() => { onDashboard(); setOpen(false); }}
                    className={`text-sm font-medium px-4 py-2.5 rounded-xl text-left transition-colors ${currentPage === 'dashboard' ? 'text-brand-600 bg-brand-50' : 'text-navy-600 hover:bg-navy-50'}`}>
                    My Account
                  </button>
                )}
                <button onClick={() => { onSignOut(); setOpen(false); }}
                  className="text-navy-500 hover:text-navy-700 text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-left">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </>
            ) : (
              <div className="px-4 pt-2 flex flex-col gap-2">
                <button onClick={() => { onApply(); setOpen(false); }}
                  className="bg-brand-500 text-white text-sm font-semibold px-5 py-3 rounded-xl text-center">
                  Get Started
                </button>
                <button onClick={() => { onSignIn(); setOpen(false); }}
                  className="text-navy-600 text-sm font-medium py-2.5 text-center">
                  Already have an account? Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
