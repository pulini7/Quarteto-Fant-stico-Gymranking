import React, { useEffect, useState } from 'react';
import { loginOrCreateUser, getUsers, saveUser, getUserByName } from '../services/storageService';
import { User } from '../types';
import { Button } from './Button';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [profiles, setProfiles] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  
  // Generic Login States (Top Bar)
  const [showLoginArea, setShowLoginArea] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Carrega os usuários existentes ao montar
  useEffect(() => {
    const fetchUsers = async () => {
        try {
            const allUsers = await getUsers();
            
            // Garante a ordem específica e que existam visualmente
            const specificNames = ['Aline', 'Samila', 'Pâmela', 'Taís'];
            
            const displayProfiles = specificNames.map(name => {
              const existing = allUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
              if (existing) return existing;
              
              // Fallback visual apenas para renderização antes de criar no banco
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
    try {
        // Busca a versão mais atualizada do usuário no DB
        // Aqui ainda usamos loginOrCreateUser porque os botões são de usuários "aprovados/conhecidos" do app
        const realUser = await loginOrCreateUser(userPreview.name);
        setSelectedUser(realUser);
        setPasswordInput('');
    } catch (e) {
        setError("Erro ao selecionar usuário.");
    } finally {
        setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!passwordInput.trim()) {
      setError("Por favor, digite uma senha.");
      return;
    }

    // Fluxo de Primeiro Acesso (Criar Senha)
    if (!selectedUser.password) {
      const updatedUser = { ...selectedUser, password: passwordInput };
      await saveUser(updatedUser); // Salva a nova senha no Supabase
      onLogin(updatedUser);
    } 
    // Fluxo de Login (Verificar Senha)
    else {
      if (selectedUser.password === passwordInput) {
        onLogin(selectedUser);
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
        // Tenta buscar o usuário ESTRITAMENTE (sem criar)
        let user = await getUserByName(loginName);

        // Exceção: Se for 'Administrador' e não existir, permite criar para bootstrap
        if (!user && loginName.toLowerCase() === 'administrador') {
             user = await loginOrCreateUser(loginName);
        }

        if (!user) {
            setError("Usuário não encontrado. Verifique o nome.");
            setLoading(false);
            return;
        }
        
        // Lógica de Admin baseada no nome
        if (user.name.toLowerCase() === 'administrador') {
            user.isAdmin = true;
            if (!user.customAvatar) {
                user.customAvatar = "https://ui-avatars.com/api/?name=Admin&background=ef4444&color=fff";
            }
        }

        // Verifica Senha ou Cria se for primeiro acesso
        if (!user.password) {
            // Primeiro acesso via login geral
            const updatedUser = { ...user, password: loginPassword };
            await saveUser(updatedUser);
            onLogin(updatedUser);
        } else {
            if (user.password === loginPassword) {
                onLogin(user);
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

  if (loading && !selectedUser && !showLoginArea) {
      return <div className="min-h-screen flex items-center justify-center text-brand-primary">Carregando academia...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-dark to-slate-900 font-sans relative">
      
      {/* Área Superior de Login Geral */}
      <div className="w-full p-4 flex justify-end absolute top-0 left-0 z-20">
        {!showLoginArea ? (
            <button 
                onClick={() => setShowLoginArea(true)}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700 hover:bg-slate-700"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
                Login
            </button>
        ) : (
            <div className="flex flex-col items-end gap-2 animate-fade-in z-30">
                <div className="bg-slate-800 p-3 rounded-xl shadow-2xl border border-slate-700 flex flex-col gap-2 min-w-[200px]">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acesso Geral</span>
                        <button 
                            onClick={() => { setShowLoginArea(false); setError(null); }}
                            className="text-slate-500 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                    <form onSubmit={handleGenericLoginSubmit} className="flex flex-col gap-2">
                        <input 
                            type="text" 
                            value={loginName}
                            onChange={(e) => setLoginName(e.target.value)}
                            placeholder="Nome do Usuário"
                            className="bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-brand-primary outline-none"
                            autoFocus
                        />
                        <input 
                            type="password" 
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="Senha"
                            className="bg-slate-900 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-brand-primary outline-none"
                        />
                        <button type="submit" className="bg-brand-primary text-white text-sm font-bold px-3 py-2 rounded hover:bg-blue-600 transition-colors shadow-lg">
                            Entrar
                        </button>
                    </form>
                    {error && <span className="text-xs text-brand-danger text-center">{error}</span>}
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="text-center mb-10 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent mb-2 leading-tight">
              QUARTETO FANTÁSTICO<br/>GYMRANKING
            </h1>
            <p className="text-slate-400 mt-4 text-lg">Quem está treinando hoje?</p>
            {error && !selectedUser && !showLoginArea && (
                 <p className="text-brand-danger text-xs mt-2 bg-red-900/20 inline-block px-3 py-1 rounded-full border border-red-900/50 animate-pulse">
                    ⚠️ {error}
                 </p>
            )}
          </div>

          {/* Grid de Perfis */}
          <div className="grid grid-cols-2 gap-6 animate-fade-in">
            {profiles.map((user) => {
               const avatarSrc = user.customAvatar || `https://picsum.photos/seed/${user.avatarSeed}/200`;
               const isLocked = !!user.password;
               
               return (
                <button 
                  key={user.name}
                  onClick={() => handleUserSelect(user)}
                  className="group relative flex flex-col items-center justify-center p-4 rounded-3xl transition-all duration-300 hover:bg-slate-800/50"
                >
                  {/* Status Icon */}
                  <div className="absolute top-3 right-3 z-10">
                      {isLocked ? (
                          <div className="bg-slate-800/80 text-brand-primary p-1.5 rounded-full backdrop-blur-md border border-slate-600 shadow-lg" title="Protegido">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          </div>
                      ) : (
                          <div className="bg-brand-accent/20 text-brand-accent p-1.5 rounded-full backdrop-blur-md border border-brand-accent/40 shadow-lg animate-pulse" title="Configurar Acesso">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                          </div>
                      )}
                  </div>

                  <div className="relative w-28 h-28 mb-4">
                    <div className="absolute inset-0 bg-brand-primary rounded-full blur opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
                    <img 
                      src={avatarSrc} 
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover border-4 border-transparent group-hover:border-brand-primary transition-all duration-300 shadow-xl group-hover:scale-105 bg-slate-700"
                    />
                  </div>
                  
                  <span className="text-xl font-bold text-slate-300 group-hover:text-white transition-colors">
                    {user.name}
                  </span>

                  {/* Badge de Streak se for > 0 */}
                  {user.streak > 0 && (
                     <span className="absolute bottom-4 bg-brand-accent text-brand-dark text-xs font-bold px-2 py-1 rounded-full shadow-lg scale-90 group-hover:scale-100 transition-transform flex items-center gap-1">
                       🔥 {user.streak} dias
                     </span>
                  )}
                </button>
               );
            })}
          </div>
          
          <div className="mt-12 text-center pt-6 opacity-50">
             <p className="text-xs text-slate-500 uppercase tracking-widest">GymRank v1.1</p>
          </div>
        </div>
      </div>

      {/* Modal de Senha para Usuários Comuns */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
          <div className="bg-brand-card w-full max-w-sm rounded-3xl border border-slate-700 p-8 shadow-2xl relative">
            <button 
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <img 
                src={selectedUser.customAvatar || `https://picsum.photos/seed/${selectedUser.avatarSeed}/200`}
                alt={selectedUser.name}
                className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-brand-primary shadow-lg"
              />
              <h2 className="text-2xl font-bold text-white">
                {(!selectedUser.password) ? 'Configuração Inicial' : `Olá, ${selectedUser.name}!`}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {(!selectedUser.password) 
                    ? 'Para sua segurança, defina uma senha exclusiva para seu perfil.' 
                    : 'Digite sua senha para confirmar que é você.'}
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <input 
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={(!selectedUser.password) ? "Crie sua senha" : "Sua senha"}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-center text-white text-lg focus:ring-2 focus:ring-brand-primary outline-none tracking-widest placeholder:text-slate-600 placeholder:tracking-normal"
                  autoFocus
                />
                {error && (
                  <p className="text-brand-danger text-xs text-center mt-2 animate-pulse bg-red-900/20 p-2 rounded-lg border border-red-900/50">
                    ⚠️ {error}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                fullWidth 
                variant={(!selectedUser.password) ? 'accent' : 'primary'}
                className="py-4 text-lg"
              >
                {(!selectedUser.password) ? 'Registrar Senha' : 'Acessar Academia'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};