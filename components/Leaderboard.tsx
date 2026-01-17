import React, { useMemo, useState } from 'react';
import { getUsers } from '../services/storageService';

type RankMode = 'xp' | 'streak';

export const Leaderboard: React.FC = () => {
  const [mode, setMode] = useState<RankMode>('xp');

  const sortedUsers = useMemo(() => {
    const all = getUsers();
    return [...all].sort((a, b) => {
      if (mode === 'xp') {
        // Sort by Score desc, then check-ins count
        return ((b.score || 0) - (a.score || 0)) || (b.checkIns.length - a.checkIns.length);
      } else {
        // Sort by streak desc, then score
        return (b.streak - a.streak) || ((b.score || 0) - (a.score || 0));
      }
    });
  }, [mode]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Ranking da Academia</h2>
        <p className="text-slate-400 text-sm">Guerreiras do Fim de Semana Ganham Dobro!</p>
      </div>

      {/* Toggle Switch */}
      <div className="bg-slate-800 p-1 rounded-xl flex space-x-1 border border-slate-700">
        <button
          onClick={() => setMode('xp')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            mode === 'xp' 
              ? 'bg-brand-primary text-white shadow-lg' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          Ranking XP ⚡
        </button>
        <button
          onClick={() => setMode('streak')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
            mode === 'streak' 
              ? 'bg-brand-accent text-brand-dark shadow-lg' 
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          Maior Streak 🔥
        </button>
      </div>

      <div className="space-y-3">
        {sortedUsers.map((u, index) => {
            const isTop3 = index < 3;
            const score = u.score || 0;
            
            // Rank Color Logic
            let rankColor = "text-slate-500";
            let rankIcon = null;
            if (index === 0) {
                rankColor = "text-yellow-400";
                rankIcon = "👑";
            } else if (index === 1) {
                rankColor = "text-slate-300";
                rankIcon = "🥈";
            } else if (index === 2) {
                rankColor = "text-amber-700";
                rankIcon = "🥉";
            }

            const avatarSrc = u.customAvatar || `https://picsum.photos/seed/${u.avatarSeed}/100`;

            return (
                <div 
                    key={u.id} 
                    className={`flex items-center p-4 rounded-xl border transition-all duration-300 ${
                        isTop3 
                            ? 'bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-600 shadow-lg' 
                            : 'bg-transparent border-slate-800 hover:bg-slate-800/30'
                    }`}
                >
                    <div className={`w-8 font-black text-xl mr-3 text-center flex flex-col items-center justify-center ${rankColor}`}>
                        <span>{index + 1}</span>
                    </div>
                    
                    <div className="relative mr-4">
                        <img 
                            src={avatarSrc} 
                            className={`w-14 h-14 rounded-full object-cover bg-slate-700 border-2 ${index === 0 ? 'border-yellow-400' : 'border-slate-600'}`}
                            alt={u.name}
                        />
                        {rankIcon && <div className="absolute -top-2 -right-2 text-xl shadow-sm">{rankIcon}</div>}
                    </div>

                    <div className="flex-1">
                        <h3 className="text-white font-bold text-lg leading-tight">{u.name}</h3>
                        
                        {/* Status Line */}
                        <div className="flex items-center mt-1 space-x-4">
                            <div className={`flex flex-col ${mode === 'xp' ? 'opacity-100' : 'opacity-60 grayscale'}`}>
                                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Pontos (XP)</span>
                                <span className={`text-sm font-bold ${mode === 'xp' ? 'text-brand-primary' : 'text-slate-400'}`}>
                                    {score}
                                </span>
                            </div>
                            
                            <div className="w-px h-6 bg-slate-700"></div>

                            <div className={`flex flex-col ${mode === 'streak' ? 'opacity-100' : 'opacity-60 grayscale'}`}>
                                <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Streak</span>
                                <span className={`text-sm font-bold ${mode === 'streak' ? 'text-brand-accent' : 'text-slate-400'}`}>
                                    {u.streak} <span className="text-xs">dias</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Highlighted Big Number for current mode */}
                    <div className="text-right pl-2">
                        {mode === 'xp' ? (
                            <span className="text-2xl font-black text-brand-primary/20">{score}</span>
                        ) : (
                            <span className="text-2xl font-black text-brand-accent/20">🔥{u.streak}</span>
                        )}
                    </div>
                </div>
            )
        })}
      </div>
    </div>
  );
};