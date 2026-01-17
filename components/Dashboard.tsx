import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Notification } from '../types';
import { performCheckIn, getTodayString, clearNotifications, saveUser, getUsers } from '../services/storageService';
import { playSound } from '../services/soundService';
import { Button } from './Button';
import { Confetti } from './Confetti';
import { AvatarModal } from './AvatarModal';
import { CheckInModal } from './CheckInModal';
import { GoatMascot, GoatMood } from './GoatMascot';

interface DashboardProps {
  user: User;
  onUpdateUser: (user: User) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onUpdateUser }) => {
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);
  const [viewProofCaption, setViewProofCaption] = useState<string | undefined>(undefined);
  const [rivalryNotification, setRivalryNotification] = useState<Notification | null>(null);
  const [loading, setLoading] = useState(false);
  const [goatMood, setGoatMood] = useState<GoatMood>(null);
  
  // Ref para detectar level up sem renderizar
  const prevLevelRef = useRef(Math.floor((user.score || 0) / 100) + 1);

  const today = getTodayString();
  
  // Memoize checkin status to avoid array scan on every render
  const todaysCheckIn = useMemo(() => 
    user.checkIns.find(c => c.date === today), 
  [user.checkIns, today]);

  // Check if it's weekend
  const d = new Date();
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;

  // --- RPG LEVEL LOGIC (Memoized) ---
  const { level, currentLevelXp, xpToNextLevel, progressPercent, levelTitle } = useMemo(() => {
      const lvl = Math.floor((user.score || 0) / 100) + 1;
      const curXp = (user.score || 0) % 100;
      const nextXp = 100;
      const prog = (curXp / nextXp) * 100;
      
      let title = "Iniciante";
      if (lvl >= 50) title = "Lenda Viva";
      else if (lvl >= 20) title = "Monstro";
      else if (lvl >= 10) title = "Maromba";
      else if (lvl >= 5) title = "Rato de Academia";

      return { level: lvl, currentLevelXp: curXp, xpToNextLevel: nextXp, progressPercent: prog, levelTitle: title };
  }, [user.score]);

  // Efeito sonoro de Level UP
  useEffect(() => {
    if (level > prevLevelRef.current) {
        playSound.levelUp();
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    }
    prevLevelRef.current = level;
  }, [level]);

  // --- HEATMAP LOGIC (Memoized) ---
  const { daysArray, daysInMonth, currentMonth, currentYear } = useMemo(() => {
      const now = new Date();
      const cYear = now.getFullYear();
      const cMonth = now.getMonth();
      const dInMonth = new Date(cYear, cMonth + 1, 0).getDate();
      const dArray = Array.from({ length: dInMonth }, (_, i) => i + 1);
      return { daysArray: dArray, daysInMonth: dInMonth, currentMonth: cMonth, currentYear: cYear };
  }, []);

  // --- BADGES LOGIC (Memoized) ---
  const badges = useMemo(() => [
      { 
          id: 'weekend', 
          icon: '🍺', 
          title: 'Inimiga do Fim', 
          desc: 'Treinou Sáb ou Dom', 
          unlocked: user.checkIns.some(c => { 
              const dt = new Date(c.date + 'T12:00:00'); 
              return dt.getDay() === 0 || dt.getDay() === 6; 
          }) 
      },
      { 
          id: 'streak5', 
          icon: '🚀', 
          title: 'Foguete', 
          desc: 'Streak de 5 dias', 
          unlocked: user.streak >= 5 
      },
      { 
          id: 'early', 
          icon: '☀️', 
          title: 'Madrugadora', 
          desc: 'Treinou antes das 7h', 
          unlocked: user.checkIns.some(c => {
              const h = new Date(c.timestamp).getHours();
              return h < 7 && h > 3; // Entre 3h e 7h
          }) 
      },
      { 
          id: 'influencer', 
          icon: '📸', 
          title: 'Influencer', 
          desc: 'Postou 5 fotos', 
          unlocked: user.checkIns.filter(c => c.photo).length >= 5 
      },
      {
          id: 'tank',
          icon: '🦍',
          title: 'Tanque de Guerra',
          desc: '15 treinos totais',
          unlocked: user.checkIns.length >= 15
      }
  ], [user.checkIns, user.streak]);

  useEffect(() => {
    setHasCheckedIn(!!todaysCheckIn);
  }, [user, todaysCheckIn]);

  useEffect(() => {
    if (user.notifications && user.notifications.length > 0) {
        setRivalryNotification(user.notifications[0]);
    }

    if (!todaysCheckIn && user.checkIns.length > 0) {
        // Simple logic to find last checkin without expensive sort if possible
        const sortedCheckIns = [...user.checkIns].sort((a, b) => b.date.localeCompare(a.date));
        const lastCheckIn = sortedCheckIns[0];
        
        if (lastCheckIn) {
            const lastDate = new Date(lastCheckIn.date + 'T12:00:00');
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - lastDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;

            if (diffDays >= 3) {
                setGoatMood('SLEEPING');
            } else if (user.streak === 0 && diffDays >= 1 && diffDays < 3) {
                setGoatMood('DISAPPOINTED');
            }
        }
    }
  }, [user.notifications, user.checkIns, user.streak, todaysCheckIn]);

  const handleDismissRivalry = async () => {
    playSound.click();
    setRivalryNotification(null);
    const updatedUser = await clearNotifications(user.id);
    if (updatedUser) {
        onUpdateUser(updatedUser);
    }
  };

  const handleCheckInComplete = async (photoBase64: string, caption: string) => {
    setLoading(true);
    const updated = await performCheckIn(user.id, photoBase64, caption);
    
    if (updated) {
        playSound.success();
        const allUsers = await getUsers();
        const validUsers = allUsers.filter(u => !['vitor_pulini@hotmail.com', 'administrador', 'admin'].includes(u.name.toLowerCase()));
        
        if (validUsers.length > 0 && validUsers[0].id === updated.id) {
            setTimeout(() => setGoatMood('CELEBRATING'), 500);
        } else {
            setTimeout(() => setGoatMood('CHECKIN_DONE'), 500);
        }
    }

    setLoading(false);
    
    if (updated) {
      onUpdateUser(updated);
      setHasCheckedIn(true);
      setIsCheckInModalOpen(false);
    }
  };

  const handleSaveAvatar = async (newAvatarBase64: string) => {
    const updatedUser = { ...user, customAvatar: newAvatarBase64 };
    onUpdateUser(updatedUser);
    await saveUser(updatedUser);
    setIsAvatarModalOpen(false);
  };

  const openProofModal = () => {
    playSound.click();
    if (todaysCheckIn) {
        setViewProofUrl(todaysCheckIn.photo);
        setViewProofCaption(todaysCheckIn.caption);
    }
  };

  const closeProofModal = () => {
      setViewProofUrl(null);
      setViewProofCaption(undefined);
  }

  const currentAvatarSrc = user.customAvatar || `https://picsum.photos/seed/${user.avatarSeed}/200`;

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {showConfetti && <Confetti />}
      <GoatMascot mood={goatMood} onDismiss={() => { playSound.click(); setGoatMood(null); }} />

      {/* RIVALRY ALERT MODAL */}
      {rivalryNotification && !goatMood && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-red-900/80 backdrop-blur-md animate-bounce-in">
            <div className="bg-brand-card border-2 border-red-500 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse"></div>
                <div className="text-6xl mb-4">🚨</div>
                <h3 className="text-2xl font-black text-white italic uppercase mb-2">Alerta de Rival!</h3>
                <p className="text-lg text-slate-200 font-bold mb-6">"{rivalryNotification.message}"</p>
                <Button onClick={handleDismissRivalry} variant="danger" fullWidth className="animate-pulse">ACEITO O DESAFIO! 😡</Button>
            </div>
        </div>
      )}

      {isAvatarModalOpen && <AvatarModal currentAvatar={currentAvatarSrc} onSave={handleSaveAvatar} onClose={() => setIsAvatarModalOpen(false)} />}
      {isCheckInModalOpen && <CheckInModal onConfirm={handleCheckInComplete} onClose={() => setIsCheckInModalOpen(false)} />}
      {viewProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in" onClick={closeProofModal}>
            <div className="relative max-w-lg w-full bg-brand-card rounded-2xl border border-slate-700 p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
                <button onClick={closeProofModal} className="absolute -top-10 right-0 text-white hover:text-slate-300 bg-slate-800/50 rounded-full p-2">✕ Fechar</button>
                <div className="w-full h-auto bg-black rounded-xl overflow-hidden">
                    <img src={viewProofUrl} alt="Comprovação do Dia" className="w-full h-full object-contain max-h-[60vh]" />
                </div>
                <div className="p-4 text-center">
                    <p className="text-brand-accent font-bold flex items-center justify-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Treino Confirmado</p>
                    <p className="text-slate-400 text-xs mt-1">{formatDate(today)}</p>
                    {viewProofCaption && <p className="mt-3 text-white italic">"{viewProofCaption}"</p>}
                </div>
            </div>
        </div>
      )}
      
      {isWeekend && !hasCheckedIn && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-3 text-white text-center shadow-lg animate-pulse border border-white/20">
            <p className="text-xs font-bold tracking-widest uppercase">Modo Fim de Semana Ativo</p>
            <p className="text-lg font-black flex items-center justify-center gap-2">⚡ XP EM DOBRO HOJE ⚡</p>
        </div>
      )}

      {/* Main Profile Card with RPG Level Bar */}
      <div className="bg-brand-card rounded-3xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M6 5v14M18 5v14M2 12h20"/></svg>
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-4 py-4">
            <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-slate-700 p-1 border-2 border-brand-accent mb-2 overflow-hidden relative">
                    <img src={currentAvatarSrc} alt="Profile" className="w-full h-full rounded-full object-cover" />
                </div>
                <button onClick={() => { playSound.click(); setIsAvatarModalOpen(true); }} className="absolute bottom-2 right-0 bg-brand-primary text-white p-2 rounded-full shadow-lg border-2 border-slate-800 hover:scale-110 transition-transform" title="Editar Avatar">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
            </div>
            
            <div className="w-full max-w-[200px]">
                <h2 className="text-2xl font-bold text-white leading-none">{user.name}</h2>
                <p className="text-xs text-brand-accent uppercase tracking-widest font-bold mb-3">{levelTitle}</p>
                
                {/* RPG Progress Bar */}
                <div className="relative w-full h-4 bg-slate-800 rounded-full border border-slate-600 overflow-hidden shadow-inner">
                    <div 
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-pink-500 via-brand-primary to-brand-accent transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    >
                        <div className="w-full h-full animate-pulse opacity-50 bg-white/20"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow-md z-10">
                        NÍVEL {level}
                    </div>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                    <span>{currentLevelXp} XP</span>
                    <span>{xpToNextLevel} XP</span>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center transform hover:scale-[1.02] transition-transform">
            <p className="text-brand-accent text-3xl font-black">{user.streak}</p>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Dias Streak</p>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center transform hover:scale-[1.02] transition-transform">
            <p className="text-brand-primary text-3xl font-black">{user.checkIns.length}</p>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Total Treinos</p>
        </div>
      </div>

      {/* HEATMAP CALENDAR */}
      <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                Frequência ({d.toLocaleString('pt-BR', { month: 'long' })})
            </h3>
            <span className="text-xs text-brand-accent">{Math.round((user.checkIns.length / daysInMonth) * 100)}%</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
            {['D','S','T','Q','Q','S','S'].map((day, i) => (
                <div key={i} className="text-[10px] text-center text-slate-500 font-bold mb-1">{day}</div>
            ))}
            {Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square"></div>
            ))}
            {daysArray.map(day => {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const checked = user.checkIns.some(c => c.date === dateStr);
                const isToday = day === d.getDate();
                
                return (
                    <div 
                        key={day} 
                        className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-bold transition-all
                            ${checked ? 'bg-brand-accent text-white shadow-[0_0_8px_rgba(236,72,153,0.4)]' : 'bg-slate-700/50 text-slate-600'}
                            ${isToday && !checked ? 'border border-slate-500 text-slate-300' : ''}
                        `}
                    >
                        {day}
                    </div>
                );
            })}
        </div>
      </div>

      {/* TROPHY ROOM (BADGES) */}
      <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            Sala de Troféus
        </h3>
        <div className="grid grid-cols-4 gap-2">
            {badges.map(badge => (
                <div 
                    key={badge.id} 
                    className={`flex flex-col items-center p-2 rounded-xl border transition-all ${badge.unlocked ? 'bg-gradient-to-b from-slate-700 to-slate-800 border-yellow-500/30 hover:scale-105 cursor-pointer' : 'bg-slate-800/30 border-transparent opacity-50 grayscale'}`}
                    onClick={() => badge.unlocked && playSound.click()}
                    title={badge.desc}
                >
                    <div className={`text-2xl mb-1 ${badge.unlocked ? 'animate-bounce-subtle drop-shadow-md' : ''}`}>{badge.icon}</div>
                    <span className="text-[9px] text-center font-bold text-slate-300 leading-tight">{badge.title}</span>
                </div>
            ))}
        </div>
        <p className="text-center text-[10px] text-slate-600 mt-3 italic">Continue treinando para desbloquear novas conquistas.</p>
      </div>

      <div className="pt-2 pb-6">
        <Button 
            onClick={() => { playSound.click(); hasCheckedIn ? openProofModal() : setIsCheckInModalOpen(true); }} 
            disabled={loading || (hasCheckedIn && !todaysCheckIn?.photo)} 
            fullWidth 
            className={`py-6 text-xl uppercase tracking-widest shadow-xl ${!hasCheckedIn ? 'animate-pulse' : ''}`}
            variant={hasCheckedIn ? 'primary' : 'accent'}
        >
            {loading ? 'Processando...' : (hasCheckedIn ? 'Ver Comprovação 📸' : (isWeekend ? 'Check-in (XP x2) ⚡' : 'Fazer Check-in Agora'))}
        </Button>
        {hasCheckedIn && <p className="text-center text-slate-500 text-sm mt-3 animate-fade-in">Treino de hoje pago! Volte amanhã.</p>}
      </div>
    </div>
  );
};