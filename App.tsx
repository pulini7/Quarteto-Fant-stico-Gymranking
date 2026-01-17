import React, { useState, useEffect, Suspense, lazy } from 'react';
import { User, Tab } from './types';
import { Login } from './components/Login';
import { Navbar } from './components/Navbar';
import { CookieConsent } from './components/CookieConsent';
import { loginOrCreateUser } from './services/storageService';
import { playSound } from './services/soundService';

// Lazy loading components to reduce initial bundle size
const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const Feed = lazy(() => import('./components/Feed').then(module => ({ default: module.Feed })));
const Leaderboard = lazy(() => import('./components/Leaderboard').then(module => ({ default: module.Leaderboard })));
const CoachAI = lazy(() => import('./components/CoachAI').then(module => ({ default: module.CoachAI })));

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Verifica sessão salva ao iniciar
  useEffect(() => {
    const checkSession = async () => {
        const storedName = localStorage.getItem('gymrank_auth_user');
        if (storedName) {
            try {
                // Tenta logar automaticamente com o nome salvo
                const u = await loginOrCreateUser(storedName);
                if (u) {
                    setUser(u);
                } else {
                    localStorage.removeItem('gymrank_auth_user');
                }
            } catch (e) {
                console.error("Erro ao restaurar sessão:", e);
                localStorage.removeItem('gymrank_auth_user');
            }
        }
    };
    checkSession();
  }, []);
  
  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const handleLogout = () => {
      localStorage.removeItem('gymrank_auth_user');
      setUser(null);
  };

  const toggleChat = () => {
      playSound.click();
      setIsChatOpen(!isChatOpen);
  }

  // Loading Fallback Component
  const LoadingScreen = () => (
    <div className="flex items-center justify-center h-64 animate-pulse">
        <div className="text-brand-primary font-bold text-lg">Carregando...</div>
    </div>
  );

  if (!user) {
    return (
        <>
            <Login onLogin={setUser} />
            <CookieConsent />
        </>
    );
  }

  const renderContent = () => {
    return (
      <Suspense fallback={<LoadingScreen />}>
        {activeTab === Tab.DASHBOARD && <Dashboard user={user} onUpdateUser={handleUpdateUser} />}
        {activeTab === Tab.FEED && <Feed currentUser={user} />}
        {activeTab === Tab.LEADERBOARD && <Leaderboard />}
      </Suspense>
    );
  };

  return (
    <div className="min-h-screen bg-brand-dark text-slate-100 flex flex-col font-sans">
      <div className="flex-1 p-6 pb-24 max-w-lg mx-auto w-full">
        {/* Header Small */}
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-lg font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent leading-none">
                QUARTETO FANTÁSTICO<br/>GYMRANKING
            </h1>
            <button 
                onClick={handleLogout} 
                className="text-xs text-slate-500 hover:text-white transition-colors"
            >
                Sair
            </button>
        </div>

        {renderContent()}
      </div>
      
      {/* Floating Chat Button */}
      <button 
        onClick={toggleChat}
        className="fixed bottom-24 right-4 z-40 w-16 h-16 bg-gradient-to-tr from-slate-700 to-slate-900 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)] border-2 border-brand-primary flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-bounce-subtle overflow-hidden p-1"
        title="Falar com Coach"
      >
        <img src="https://robohash.org/GYM-COACH-MUSCLE.png?set=set1" alt="Coach Robot" className="w-full h-full object-cover" />
      </button>

      {/* Chat Modal */}
      {isChatOpen && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsChatOpen(false)}>
            <div className="w-full max-w-lg h-[85vh] sm:h-[600px] bg-brand-card sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col animate-slide-up" onClick={e => e.stopPropagation()}>
                <Suspense fallback={<LoadingScreen />}>
                    <CoachAI user={user} onClose={() => setIsChatOpen(false)} />
                </Suspense>
            </div>
        </div>
      )}
      
      <Navbar activeTab={activeTab} onSwitch={setActiveTab} />
      <CookieConsent />
    </div>
  );
};

export default App;