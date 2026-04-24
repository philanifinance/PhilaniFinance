import { useEffect } from 'react';
import { LogIn, ShieldAlert } from 'lucide-react';

interface AuthGuardProps {
  isAuthenticated: boolean;
  onRequestAuth: () => void;
  children: React.ReactNode;
}

export default function AuthGuard({ isAuthenticated, onRequestAuth, children }: AuthGuardProps) {
  useEffect(() => {
    if (!isAuthenticated) {
      onRequestAuth();
    }
  }, [isAuthenticated, onRequestAuth]);

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <section id="apply" className="bg-[#1e293b] py-20">
      <div className="max-w-xl mx-auto px-4 text-center">
        <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-10 sm:p-12">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-white font-bold text-xl mb-3">Authentication Required</h2>
          <p className="text-gray-400 leading-relaxed mb-6">
            To protect your personal information and comply with NCR regulations, you must sign in or create an account before applying for a loan.
          </p>
          <button
            onClick={onRequestAuth}
            className="inline-flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-green-500/25"
          >
            <LogIn className="w-5 h-5" />
            Sign In to Apply
          </button>
        </div>
      </div>
    </section>
  );
}
