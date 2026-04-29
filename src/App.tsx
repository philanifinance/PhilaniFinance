import { useState, useCallback, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustBar from './components/TrustBar';
import HowItWorks from './components/HowItWorks';
import ApplicationForm from './components/ApplicationForm';
import FAQ from './components/FAQ';
import CtaBanner from './components/CtaBanner';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import ClientDashboard from './components/ClientDashboard';
import ForbiddenPage from './components/ForbiddenPage';
import ToastContainer, { type ToastMessage } from './components/Toast';
import { useAdminAuth } from './lib/useAdminAuth';
import { ProfileProvider } from './lib/ProfileContext';

type Page = 'home' | 'apply' | 'admin' | 'dashboard' | 'forbidden';

function AppInner() {
  const {
    user, loading, signIn, signUp, signOut,
    isAuthenticated, isAdmin, isOwner, role,
  } = useAdminAuth();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authDefaultMode, setAuthDefaultMode] = useState<'login' | 'signup'>('login');
  const [currentPage, setCurrentPage] = useState<Page>('home');

  // Loan parameters selected from Hero calculator
  const [loanAmount, setLoanAmount] = useState(2000);
  const [loanTermDays, setLoanTermDays] = useState(14);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((t: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [...prev, { ...t, id: `t-${Date.now()}-${Math.random()}` }]);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Show welcome banner on client dashboard after submission
  const [showWelcome, setShowWelcome] = useState(false);

  // Track whether the user just authenticated (for post-login redirect)
  const prevAuthRef = useRef(isAuthenticated);

  // ── Post-Login Guard ──────────────────────────────────────────────
  useEffect(() => {
    const wasAuth = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (!wasAuth && isAuthenticated && role) {
      if (role === 'owner' || role === 'admin') {
        setCurrentPage('admin');
      } else {
        setCurrentPage('dashboard');
      }
      setAuthModalOpen(false);
      window.scrollTo(0, 0);
    }

    if (wasAuth && !isAuthenticated) {
      setCurrentPage('home');
    }
  }, [isAuthenticated, role]);

  const openAuthModal = useCallback((mode: 'login' | 'signup' = 'login') => {
    setAuthDefaultMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const goToApply = useCallback(() => {
    setCurrentPage('apply');
    window.scrollTo(0, 0);
  }, []);

  const goHome = useCallback(() => {
    setCurrentPage('home');
    window.scrollTo(0, 0);
  }, []);

  const goToAdmin = useCallback(() => {
    if (!isAdmin) {
      setCurrentPage('forbidden');
      return;
    }
    setCurrentPage('admin');
    window.scrollTo(0, 0);
  }, [isAdmin]);

  const goToDashboard = useCallback(() => {
    setCurrentPage('dashboard');
    window.scrollTo(0, 0);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    closeAuthModal();
  }, [closeAuthModal]);

  // Post-submission redirect: go to client dashboard with welcome banner
  const handleSubmitSuccess = useCallback(() => {
    setShowWelcome(true);
    setCurrentPage('dashboard');
    window.scrollTo(0, 0);
  }, []);

  // Callback from Hero to pass loan params before navigating to apply
  const handleApplyFromHero = useCallback((amount: number, days: number) => {
    setLoanAmount(amount);
    setLoanTermDays(days);
    goToApply();
  }, [goToApply]);

  // ── Loading screen ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-[#22c55e]/30 border-t-[#22c55e] rounded-full" />
      </div>
    );
  }

  // ── 403 Forbidden ──────────────────────────────────────────────────
  if (currentPage === 'forbidden') {
    return <ForbiddenPage onGoHome={goHome} onGoBack={goHome} />;
  }

  // ── Protected Admin Route ──────────────────────────────────────────
  if (currentPage === 'admin') {
    if (!isAuthenticated) {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
          <AuthModal isOpen={true} onClose={goHome} onLogin={signIn} onSignUp={signUp} defaultMode="login" onSuccess={handleAuthSuccess} />
        </div>
      );
    }
    if (!isAdmin) {
      return <ForbiddenPage onGoHome={goHome} onGoBack={goHome} />;
    }
    return (
      <div className="font-sans antialiased min-h-screen bg-[#f8fafc]">
        <Navbar user={user} onSignOut={signOut} onSignIn={() => openAuthModal('login')} onApply={goToApply} onHome={goHome} currentPage={currentPage} isAdmin={isAdmin} onAdmin={goToAdmin} onDashboard={goToDashboard} />
        <main className="pt-20"><AdminDashboard isOwner={isOwner} /></main>
        <Footer />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // ── Client Dashboard ───────────────────────────────────────────────
  if (currentPage === 'dashboard') {
    if (!isAuthenticated || !user) {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
          <AuthModal isOpen={true} onClose={goHome} onLogin={signIn} onSignUp={signUp} defaultMode="login" onSuccess={handleAuthSuccess} />
        </div>
      );
    }
    return (
      <div className="font-sans antialiased min-h-screen bg-[#f8fafc]">
        <Navbar user={user} onSignOut={signOut} onSignIn={() => openAuthModal('login')} onApply={goToApply} onHome={goHome} currentPage={currentPage} isAdmin={isAdmin} onAdmin={goToAdmin} onDashboard={goToDashboard} />
        <main className="pt-20">
          <ClientDashboard user={user} onApply={goToApply} showWelcome={showWelcome} onWelcomeDismiss={() => setShowWelcome(false)} />
        </main>
        <Footer />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // ── Client Apply Page ──────────────────────────────────────────────
  if (currentPage === 'apply') {
    return (
      <div className="font-sans antialiased min-h-screen bg-[#f8fafc]">
        <Navbar user={user} onSignOut={signOut} onSignIn={() => openAuthModal('login')} onApply={goToApply} onHome={goHome} currentPage={currentPage} isAdmin={isAdmin} onAdmin={goToAdmin} onDashboard={goToDashboard} />
        <main className="pt-20 pb-10">
          <ApplicationForm
            isAuthenticated={isAuthenticated}
            onRequestAuth={() => openAuthModal('login')}
            user={user}
            onBack={goHome}
            loanAmount={loanAmount}
            loanTermDays={loanTermDays}
            onSubmitSuccess={handleSubmitSuccess}
            addToast={addToast}
          />
        </main>
        <Footer />
        <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} onLogin={signIn} onSignUp={signUp} defaultMode={authDefaultMode} onSuccess={handleAuthSuccess} />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // ── Landing Page ───────────────────────────────────────────────────
  return (
    <div className="font-sans antialiased">
      <Navbar user={user} onSignOut={signOut} onSignIn={() => openAuthModal('login')} onApply={goToApply} onHome={goHome} currentPage={currentPage} isAdmin={isAdmin} onAdmin={goToAdmin} onDashboard={goToDashboard} />
      <Hero
        isAuthenticated={isAuthenticated}
        onRequestAuth={() => openAuthModal('login')}
        onApply={goToApply}
        onApplyWithParams={handleApplyFromHero}
      />
      <TrustBar />
      <HowItWorks />
      <FAQ />
      <CtaBanner isAuthenticated={isAuthenticated} onApply={goToApply} onRequestAuth={() => openAuthModal('login')} />
      <Footer />
      <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} onLogin={signIn} onSignUp={signUp} defaultMode={authDefaultMode} onSuccess={handleAuthSuccess} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  const { user } = useAdminAuth();
  return (
    <ProfileProvider user={user}>
      <AppInner />
    </ProfileProvider>
  );
}
