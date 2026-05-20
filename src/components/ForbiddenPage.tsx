import { ShieldX, ArrowLeft } from 'lucide-react';

interface ForbiddenPageProps {
  onGoHome: () => void;
  onGoBack?: () => void;
}

export default function ForbiddenPage({ onGoHome, onGoBack }: ForbiddenPageProps) {
  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-red-400" />
        </div>
        <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-2">Error</p>
        <h1 className="font-display text-7xl font-extrabold text-white mb-2">403</h1>
        <h2 className="text-xl font-bold text-white mb-3">Access Forbidden</h2>
        <p className="text-white/40 text-sm leading-relaxed mb-8">
          You do not have the required permissions to access this page.
          This area is restricted to authorized administrators only.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onGoBack && (
            <button onClick={onGoBack}
              className="flex items-center justify-center gap-2 bg-white/[0.06] border border-white/[0.1] text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-white/[0.1] transition-colors">
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
          )}
          <button onClick={onGoHome}
            className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-all hover:shadow-lg hover:shadow-brand-500/25">
            Go to Homepage
          </button>
        </div>
      </div>
    </div>
  );
}
