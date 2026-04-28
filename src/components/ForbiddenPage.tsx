import { ShieldX, ArrowLeft } from 'lucide-react';

interface ForbiddenPageProps {
  onGoHome: () => void;
  onGoBack?: () => void;
}

export default function ForbiddenPage({ onGoHome, onGoBack }: ForbiddenPageProps) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-6xl font-black text-gray-900 mb-2">403</h1>
        <h2 className="text-xl font-bold text-gray-900 mb-3">Access Forbidden</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          You do not have the required permissions to access this page.
          This area is restricted to authorized administrators only.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onGoBack && (
            <button
              onClick={onGoBack}
              className="flex items-center justify-center gap-2 border border-gray-200 text-gray-700 font-semibold px-6 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
          )}
          <button
            onClick={onGoHome}
            className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    </div>
  );
}
