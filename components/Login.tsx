import React, { useEffect, useState } from 'react';
import { loginOrCreateUser, getUsersLight, saveUser, getUserByName, resetUserByName } from '../services/storageService';
import { User } from '../types';
import { Button } from './Button';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [profiles, setProfiles] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  
  // Generic Login States
  const [showLoginArea, setShowLoginArea] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Persistence State
  const [rememberMe, setRememberMe] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega os usuários existentes ao montar (versão leve)
  useEffect(() => {
    const fetchUsers = async () => {
        try {
            // OPTIMIZATION: Uses getUsersLight which doesn't fetch nested check-ins/photos
            const allUsers = await getUsersLight();
            
            // Garante a ordem específica e que existam visualmente
            const specificNames = ['Aline', 'Samila', 'Pâmela', 'Taís'];
            
            const displayProfiles = specificNames.map(name => {
              const existing = allUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
              if (existing) return existing;
              
              // Fallback visual apenas para renderização
              return {
                id: name,
                name: name,
                avatarSeed: Math.floor(Math.random() * 1000),
                checkIns: [],
                streak: 0,
                score: 0
              } as User;
            });
            
            setProfiles(displayProfiles);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    
    fetchUsers();
  }, []);

  const handleUserSelect = async (userPreview: User) => {
    setError(null);
    setLoading(true);
    setRememberMe(false);
    try {
        const realUser = await loginOrCreateUser(userPreview.name);
        setSelectedUser(realUser);
        setPasswordInput('');
    } catch (e) {
        setError("Erro ao selecionar usuário.");
    } finally {
        setLoading(false);
    }
  };

  const finalizeLogin = (user: User) => {
    if (rememberMe) {
        localStorage.setItem('gymrank_auth_user', user.name);
    }
    onLogin(user);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!passwordInput.trim()) {
      setError("Por favor, digite uma senha.");
      return;
    }

    if (!selectedUser.password) {
      const updatedUser = { ...selectedUser, password: passwordInput };
      await saveUser(updatedUser);
      finalizeLogin(updatedUser);
    } else {
      if (selectedUser.password === passwordInput) {
        finalizeLogin(selectedUser);
      } else {
        setError("Senha incorreta. Tente novamente.");
        setPasswordInput('');
      }
    }
  };

  const handleGenericLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!loginName.trim() || !loginPassword.trim()) {
        setError("Preencha nome e senha.");
        return;
    }

    setLoading(true);

    try {
        let user = await getUserByName(loginName);

        if (!user && loginName.toLowerCase() === 'administrador') {
             user = await loginOrCreateUser(loginName);
        }

        if (!user) {
            setError("Usuário não encontrado. Verifique o nome.");
            setLoading(false);
            return;
        }
        
        if (user.name.toLowerCase() === 'administrador') {
            user.isAdmin = true;
            if (!user.customAvatar) {
                user.customAvatar = "https://ui-avatars.com/api/?name=Admin&background=ef4444&color=fff";
            }
        }

        if (!user.password) {
            const updatedUser = { ...user, password: loginPassword };
            await saveUser(updatedUser);
            finalizeLogin(updatedUser);
        } else {
            if (user.password === loginPassword) {
                finalizeLogin(user);
            } else {
                setError("Senha incorreta.");
            }
        }
    } catch (e) {
        setError("Erro ao realizar login.");
    } finally {
        setLoading(false);
    }
  };

  const handleResetUser = async () => {
      if (!loginName.trim()) {
          setError("Digite o email/nome para resetar.");
          return;
      }
      if (!window.confirm(`Tem certeza que deseja apagar TUDO de ${loginName}?`)) return;

      setLoading(true);
      const success = await resetUserByName(loginName);
      setLoading(false);
      
      if (success) {
          setError("Usuário resetado com sucesso! ✅");
          setLoginName('');
          setLoginPassword('');
      } else {
          setError("Usuário não encontrado.");
      }
  };

  if (loading && !selectedUser && !showLoginArea) {
      return <div className="min-h-screen flex items-center justify-center text-brand-primary">Carregando GymRanking...</div>;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-brand-dark to-slate-900 font-sans relative overflow-x-hidden">
      <div className="w-full p-4 flex justify-end absolute top-0 left-0 z-20">
        {!showLoginArea ? (
            <button 
                onClick={() => { setShowLoginArea(true); setRememberMe(false); }}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700 hover:bg-slate-700 backdrop-blur-sm"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
                Login
            </button>
        ) : (
            <div className="fixed inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-700 flex flex-col gap-4 w-full max-w-xs animate-scale-up">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Acesso Geral</span>
                        <button onClick={() => { setShowLoginArea(false); setError(null); }} className="text-slate-500 hover:text-white p-2">✕</button>
                    </div>
                    <form onSubmit={handleGenericLoginSubmit} className="flex flex-col gap-3">
                        {/* Text-base evita zoom no iPhone */}
                        <input type="text" value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="Nome do Usuário" className="bg-slate-900 text-white text-base px-4 py-3 rounded-xl border border-slate-600 focus:border-brand-primary outline-none" autoFocus />
                        <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Senha" className="bg-slate-900 text-white text-base px-4 py-3 rounded-xl border border-slate-600 focus:border-brand-primary outline-none" />
                        <div className="flex items-center gap-2 px-1">
                            <input type="checkbox" id="generic-remember" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-5 h-5 accent-brand-primary cursor-pointer" />
                            <label htmlFor="generic-remember" className="text-sm text-slate-400 cursor-pointer select-none">Manter conectado</label>
                        </div>
                        <div className="flex gap-2 mt-2">
                            <button type="submit" className="flex-1 bg-brand-primary text-white text-base font-bold px-3 py-3 rounded-xl hover:bg-pink-600 transition-colors shadow-lg active:scale-95">Entrar</button>
                            <button type="button" onClick={handleResetUser} className="bg-slate-700 text-slate-300 px-4 py-3 rounded-xl hover:bg-red-900 hover:text-white transition-colors" title="Resetar Usuário">🗑️</button>
                        </div>
                    </form>
                    {error && <span className="text-sm text-brand-danger text-center bg-red-900/20 p-2 rounded-lg">{error}</span>}
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="text-center mb-8 animate-fade-in w-full">
            <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent mb-2 leading-tight drop-shadow-sm">
                QUARTETO FANTÁSTICO<br/>GYMRANKING
            </h1>
            <p className="text-slate-400 mt-2 text-base sm:text-lg">Quem está treinando hoje?</p>
            {error && !selectedUser && !showLoginArea && (
                 <p className="text-brand-danger text-sm mt-4 bg-red-900/20 inline-block px-4 py-2 rounded-lg border border-red-900/50 animate-pulse">⚠️ {error}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full animate-fade-in">
            {profiles.map((user) => {
               const avatarSrc = user.customAvatar || `https://picsum.photos/seed/${user.avatarSeed}/200`;
               const isLocked = !!user.password;
               
               return (
                <button 
                  key={user.name}
                  onClick={() => handleUserSelect(user)}
                  className="group relative flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-800/30 border border-slate-800 transition-all duration-200 active:scale-95 active:bg-slate-800 touch-manipulation"
                >
                  <div className="absolute top-2 right-2 z-10">
                      {isLocked ? (
                          <div className="bg-slate-800/90 text-brand-primary p-1.5 rounded-full backdrop-blur-md border border-slate-600 shadow-lg"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                      ) : (
                          <div className="bg-brand-accent/20 text-brand-accent p-1.5 rounded-full backdrop-blur-md border border-brand-accent/40 shadow-lg animate-pulse"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg></div>
                      )}
                  </div>
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-3">
                    <img src={avatarSrc} alt={user.name} className="w-full h-full rounded-full object-cover border-4 border-slate-700 shadow-xl bg-slate-700" loading="lazy" />
                  </div>
                  <span className="text-lg font-bold text-slate-200">{user.name}</span>
                  {user.streak > 0 && <span className="absolute -bottom-2 bg-brand-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-brand-card flex items-center gap-1">🔥 {user.streak}</span>}
                </button>
               );
            })}
          </div>
          <div className="mt-8 text-center opacity-40"><p className="text-[10px] text-slate-500 uppercase tracking-widest">GymRank Mobile v1.2</p></div>
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-brand-card w-full max-w-sm rounded-3xl border border-slate-700 p-6 shadow-2xl relative">
            <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white p-2">✕</button>
            <div className="text-center mb-6 mt-2">
              <img src={selectedUser.customAvatar || `https://picsum.photos/seed/${selectedUser.avatarSeed}/200`} alt={selectedUser.name} className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-brand-primary shadow-lg" />
              <h2 className="text-2xl font-bold text-white">{(!selectedUser.password) ? 'Criar Senha' : `Olá, ${selectedUser.name}!`}</h2>
              <p className="text-slate-400 text-xs mt-1">{(!selectedUser.password) ? 'Defina uma senha para proteger seu perfil.' : 'Confirme sua senha para entrar.'}</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder={(!selectedUser.password) ? "Nova senha" : "Senha"} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-center text-white text-xl focus:ring-2 focus:ring-brand-primary outline-none tracking-widest placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-base" autoFocus />
                {error && <p className="text-brand-danger text-xs text-center mt-2 animate-pulse bg-red-900/20 p-2 rounded-lg border border-red-900/50">⚠️ {error}</p>}
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                 <input type="checkbox" id="modal-remember" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-5 h-5 accent-brand-primary cursor-pointer rounded bg-slate-800 border-slate-600" />
                 <label htmlFor="modal-remember" className="text-sm text-slate-400 cursor-pointer select-none">Manter conectado</label>
              </div>
              <Button type="submit" fullWidth variant={(!selectedUser.password) ? 'accent' : 'primary'} className="py-4 text-lg shadow-xl active:scale-95">{(!selectedUser.password) ? 'Salvar Senha' : 'Acessar'}</Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};