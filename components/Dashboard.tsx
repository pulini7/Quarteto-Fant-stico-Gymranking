import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { performCheckIn, getTodayString } from '../services/storageService';
import { Button } from './Button';
import { Confetti } from './Confetti';
import { AvatarModal } from './AvatarModal';
import { CheckInModal } from './CheckInModal';

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

  const today = getTodayString();
  const todaysCheckIn = user.checkIns.find(c => c.date === today);

  // Check if it's weekend
  const d = new Date();
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;

  useEffect(() => {
    setHasCheckedIn(!!todaysCheckIn);
  }, [user, todaysCheckIn]);

  const handleCheckInComplete = (photoBase64: string, caption: string) => {
    const updated = performCheckIn(user.id, photoBase64, caption);
    if (updated) {
      onUpdateUser(updated);
      setHasCheckedIn(true);
      setShowConfetti(true);
      setIsCheckInModalOpen(false);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  };

  const handleSaveAvatar = (newAvatarBase64: string) => {
    const updatedUser = { ...user, customAvatar: newAvatarBase64 };
    onUpdateUser(updatedUser);
    import('../services/storageService').then(mod => mod.saveUser(updatedUser));
    setIsAvatarModalOpen(false);
  };

  const openProofModal = () => {
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

  // Get last 5 check-ins (sorted by date desc)
  const recentCheckIns = [...user.checkIns]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {showConfetti && <Confetti />}
      
      {isAvatarModalOpen && (
        <AvatarModal 
            currentAvatar={currentAvatarSrc} 
            onSave={handleSaveAvatar} 
            onClose={() => setIsAvatarModalOpen(false)} 
        />
      )}

      {isCheckInModalOpen && (
        <CheckInModal 
            onConfirm={handleCheckInComplete}
            onClose={() => setIsCheckInModalOpen(false)}
        />
      )}

      {/* Modal de Visualização de Comprovação */}
      {viewProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in" onClick={closeProofModal}>
            <div className="relative max-w-lg w-full bg-brand-card rounded-2xl border border-slate-700 p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
                <button 
                    onClick={closeProofModal}
                    className="absolute -top-10 right-0 text-white hover:text-slate-300 bg-slate-800/50 rounded-full p-2"
                >
                    ✕ Fechar
                </button>
                <div className="w-full h-auto bg-black rounded-xl overflow-hidden">
                    <img src={viewProofUrl} alt="Comprovação do Dia" className="w-full h-full object-contain max-h-[60vh]" />
                </div>
                <div className="p-4 text-center">
                    <p className="text-brand-accent font-bold flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        Treino Confirmado
                    </p>
                    <p className="text-slate-400 text-xs mt-1">{formatDate(today)}</p>
                    {viewProofCaption && (
                        <p className="mt-3 text-white italic">"{viewProofCaption}"</p>
                    )}
                </div>
            </div>
        </div>
      )}
      
      {/* Weekend Banner */}
      {isWeekend && !hasCheckedIn && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-3 text-white text-center shadow-lg animate-pulse border border-white/20">
            <p className="text-xs font-bold tracking-widest uppercase">Modo Fim de Semana Ativo</p>
            <p className="text-lg font-black flex items-center justify-center gap-2">
                ⚡ XP EM DOBRO HOJE ⚡
            </p>
        </div>
      )}

      <div className="bg-brand-card rounded-3xl p-6 border border-slate-700 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M6 5v14M18 5v14M2 12h20"/></svg>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-4 py-6">
            <div className="relative group">
                <div className="w-28 h-28 rounded-full bg-slate-700 p-1 border-2 border-brand-accent mb-2 overflow-hidden relative">
                    <img 
                        src={currentAvatarSrc} 
                        alt="Profile" 
                        className="w-full h-full rounded-full object-cover"
                    />
                </div>
                <button 
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="absolute bottom-2 right-0 bg-brand-primary text-white p-2 rounded-full shadow-lg border-2 border-slate-800 hover:scale-110 transition-transform"
                    title="Editar Avatar"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
            </div>
            <div>
                <h2 className="text-2xl font-bold text-white">Olá, {user.name}!</h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                   <span className="bg-slate-800/80 px-3 py-1 rounded-full text-xs font-bold text-brand-primary border border-slate-600">
                     LVL {Math.floor((user.score || 0) / 100) + 1}
                   </span>
                   <span className="text-slate-400 text-sm">{user.score || 0} XP</span>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center">
            <p className="text-brand-accent text-3xl font-black">{user.streak}</p>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Dias Streak</p>
        </div>
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 text-center">
            <p className="text-brand-primary text-3xl font-black">{user.checkIns.length}</p>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Total Treinos</p>
        </div>
      </div>

      {/* Recent Check-ins Section */}
      <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/50">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
            Últimos 5 Treinos
        </h3>
        {recentCheckIns.length > 0 ? (
            <div className="space-y-2">
                {recentCheckIns.map((checkIn) => (
                    <div key={checkIn.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
                        <div className="flex flex-col">
                            <span className="text-slate-200 font-mono text-sm pl-2">{formatDate(checkIn.date)}</span>
                            {checkIn.caption && <span className="text-xs text-slate-500 pl-2 truncate max-w-[150px]">"{checkIn.caption}"</span>}
                        </div>
                        <div className="flex items-center text-brand-accent text-xs font-semibold pr-2">
                            <span className="mr-1">Foto Enviada</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-slate-500 text-sm text-center py-2 italic">Nenhum treino registrado ainda.</p>
        )}
      </div>

      <div className="pt-2 pb-6">
        <Button 
            onClick={hasCheckedIn ? openProofModal : () => setIsCheckInModalOpen(true)} 
            disabled={hasCheckedIn && !todaysCheckIn?.photo} 
            fullWidth 
            className={`py-6 text-xl uppercase tracking-widest shadow-xl ${!hasCheckedIn ? 'animate-pulse' : ''}`}
            variant={hasCheckedIn ? 'primary' : 'accent'}
        >
            {hasCheckedIn ? 'Ver Comprovação 📸' : (isWeekend ? 'Check-in (XP x2) ⚡' : 'Fazer Check-in Agora')}
        </Button>
        {hasCheckedIn && (
            <p className="text-center text-slate-500 text-sm mt-3 animate-fade-in">
                Treino de hoje pago! Volte amanhã.
            </p>
        )}
      </div>
    </div>
  );
};