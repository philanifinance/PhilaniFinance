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
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-navy-900 border border-white/[0.08] rounded-3xl w-full max-w-md p-7 sm:p-8 shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-7">
          <div className="w-12 h-12 bg-brand-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            {mode === 'login' ? (
              <LogIn className="w-6 h-6 text-brand-400" />
            ) : (
              <UserPlus className="w-6 h-6 text-brand-400" />
            )}
          </div>
          <h2 className="font-display text-white font-extrabold text-xl">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-white/40 text-sm mt-1.5">
            {mode === 'login'
              ? 'Sign in to apply for your loan'
              : 'Register to start your loan application'}
          </p>
        </div>

        {error && (
          <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {success && (
          <div className="mb-5 bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-3 text-brand-400 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />{success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1.5 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com" required
                className="w-full bg-navy-950/60 border border-white/[0.08] text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-white/20"
              />
            </div>
          </div>

          <div>
            <label className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters" required minLength={6}
                className="w-full bg-navy-950/60 border border-white/[0.08] text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-white/20"
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-1.5 block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password" required minLength={6}
                  className="w-full bg-navy-950/60 border border-white/[0.08] text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-500/50 transition-colors placeholder:text-white/20"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-brand-500/30 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-brand-500/25"
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

        <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
          <p className="text-white/40 text-sm">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button onClick={() => handleSwitchMode('signup')}
                  className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={() => handleSwitchMode('login')}
                  className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
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
