import React, { useState, useEffect } from 'react';
import { User, Tab } from './types';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Leaderboard } from './components/Leaderboard';
import { CoachAI } from './components/CoachAI';
import { Feed } from './components/Feed';
import { Navbar } from './components/Navbar';
import { getUsers, loginOrCreateUser } from './services/storageService';

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

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case Tab.DASHBOARD:
        return <Dashboard user={user} onUpdateUser={handleUpdateUser} />;
      case Tab.FEED:
        return <Feed currentUser={user} />;
      case Tab.LEADERBOARD:
        return <Leaderboard />;
      case Tab.COACH:
        return <CoachAI user={user} />;
      default:
        return <Dashboard user={user} onUpdateUser={handleUpdateUser} />;
    }
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
      
      <Navbar activeTab={activeTab} onSwitch={setActiveTab} />
    </div>
  );
};

export default App;