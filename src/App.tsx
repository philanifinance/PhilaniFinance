import { useState, useCallback } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustBar from './components/TrustBar';
import HowItWorks from './components/HowItWorks';
import ApplicationForm from './components/ApplicationForm';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import { useAuth } from './lib/useAuth';
import { useAdminAuth } from './lib/useAdminAuth';

export default function App() {
  const { user, loading, signIn, signUp, signOut, isAuthenticated } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authDefaultMode, setAuthDefaultMode] = useState<'login' | 'signup'>('login');
  const [currentPage, setCurrentPage] = useState<'home' | 'apply' | 'admin'>('home');
  const { isAdmin } = useAdminAuth();

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
    setCurrentPage('admin');
    window.scrollTo(0, 0);
  }, []);

  const handleAuthSuccess = useCallback(() => {
    closeAuthModal();
    goToApply();
  }, [closeAuthModal, goToApply]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-[#22c55e]/30 border-t-[#22c55e] rounded-full" />
      </div>
    );
  }

  if (currentPage === 'apply') {
    return (
      <div className="font-sans antialiased min-h-screen bg-[#f8fafc]">
        <Navbar
          user={user}
          onSignOut={signOut}
          onSignIn={() => openAuthModal('login')}
          onApply={goToApply}
          onHome={goHome}
          currentPage={currentPage}
          isAdmin={isAdmin}
          onAdmin={goToAdmin}
        />
        <main className="pt-20 pb-10">
          <ApplicationForm
            isAuthenticated={isAuthenticated}
            onRequestAuth={() => openAuthModal('login')}
            user={user}
            onBack={goHome}
          />
        </main>
        <Footer />
        <AuthModal
          isOpen={authModalOpen}
          onClose={closeAuthModal}
          onLogin={signIn}
          onSignUp={signUp}
          defaultMode={authDefaultMode}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  if (currentPage === 'admin') {
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              🔒
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500 text-sm mb-4">You do not have permission to access the admin dashboard.</p>
            <button
              onClick={goHome}
              className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="font-sans antialiased min-h-screen bg-[#f8fafc]">
        <Navbar
          user={user}
          onSignOut={signOut}
          onSignIn={() => openAuthModal('login')}
          onApply={goToApply}
          onHome={goHome}
          currentPage={currentPage}
          isAdmin={isAdmin}
          onAdmin={goToAdmin}
        />
        <main className="pt-20 pb-10">
          <AdminDashboard />
        </main>
        <Footer />
        <AuthModal
          isOpen={authModalOpen}
          onClose={closeAuthModal}
          onLogin={signIn}
          onSignUp={signUp}
          defaultMode={authDefaultMode}
          onSuccess={closeAuthModal}
        />
      </div>
    );
  }

  return (
    <div className="font-sans antialiased">
      <Navbar
        user={user}
        onSignOut={signOut}
        onSignIn={() => openAuthModal('login')}
        onApply={goToApply}
        onHome={goHome}
        currentPage={currentPage}
        isAdmin={isAdmin}
        onAdmin={goToAdmin}
      />
      <Hero
        isAuthenticated={isAuthenticated}
        onRequestAuth={() => openAuthModal('login')}
        onApply={goToApply}
      />
      <TrustBar />
      <HowItWorks />
      <FAQ />
      <Footer />
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        onLogin={signIn}
        onSignUp={signUp}
        defaultMode={authDefaultMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
