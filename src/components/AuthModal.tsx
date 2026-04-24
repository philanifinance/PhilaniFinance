import { useState } from 'react';
import { X, Mail, Lock, UserPlus, LogIn, AlertCircle, CheckCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<{ error?: Error | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error?: Error | null; data?: unknown }>;
  defaultMode?: 'login' | 'signup';
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, onLogin, onSignUp, defaultMode = 'login', onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const handleSwitchMode = (newMode: 'login' | 'signup') => {
    setMode(newMode);
    resetForm();
  };

  const validateForm = (): boolean => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: loginError } = await onLogin(email, password);
        if (loginError) {
          setError(loginError.message || 'Invalid email or password');
        } else {
          resetForm();
          onClose();
          onSuccess?.();
        }
      } else {
        const { error: signUpError } = await onSignUp(email, password);
        if (signUpError) {
          setError(signUpError.message || 'Sign up failed');
        } else {
          setSuccess('Account created! Please check your email to verify your account, then log in.');
          setTimeout(() => {
            handleSwitchMode('login');
          }, 3000);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1e293b] border border-white/10 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#22c55e]/10 rounded-xl flex items-center justify-center mx-auto mb-3">
            {mode === 'login' ? (
              <LogIn className="w-6 h-6 text-[#22c55e]" />
            ) : (
              <UserPlus className="w-6 h-6 text-[#22c55e]" />
            )}
          </div>
          <h2 className="text-white font-bold text-xl">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {mode === 'login'
              ? 'Sign in to apply for your loan'
              : 'Register to start your loan application'}
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl px-4 py-3 text-[#22c55e] text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm font-medium mb-1.5 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full bg-[#0f172a] border border-white/10 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors placeholder:text-gray-600"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 text-sm font-medium mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full bg-[#0f172a] border border-white/10 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors placeholder:text-gray-600"
                required
                minLength={6}
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-gray-400 text-sm font-medium mb-1.5 block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full bg-[#0f172a] border border-white/10 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-[#22c55e]/50 transition-colors placeholder:text-gray-600"
                  required
                  minLength={6}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:bg-[#22c55e]/30 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" /> Sign In
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Create Account
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => handleSwitchMode('signup')}
                  className="text-[#22c55e] hover:text-[#16a34a] font-semibold transition-colors"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => handleSwitchMode('login')}
                  className="text-[#22c55e] hover:text-[#16a34a] font-semibold transition-colors"
                >
                  Sign In
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
