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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  
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
    <div className="min-h-[100dvh] bg-brand-dark text-slate-100 flex flex-col font-sans overflow-hidden">
      <div className="flex-1 p-4 pb-28 max-w-lg mx-auto w-full overflow-y-auto scrollbar-hide">
        {/* Header Small */}
        <div className="flex justify-between items-center mb-6 pt-2 sticky top-0 z-30 bg-brand-dark/95 backdrop-blur-sm py-2">
            <h1 className="text-lg font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent leading-none">
                QUARTETO FANTÁSTICO<br/>GYMRANKING
            </h1>
            <button 
                onClick={handleLogout} 
                className="text-xs text-slate-500 hover:text-white transition-colors bg-slate-800 px-3 py-1 rounded-full"
            >
                Sair
            </button>
        </div>

        {renderContent()}
      </div>
      
      <Navbar activeTab={activeTab} onSwitch={setActiveTab} />
      <CookieConsent />
    </div>
  );
};

export default App;