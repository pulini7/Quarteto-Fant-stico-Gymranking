import React, { useMemo, useState, useEffect } from 'react';
import { getUsers, isWeekend } from '../services/storageService';
import { User, CheckIn } from '../types';

type Timeframe = 'WEEK' | 'MONTH' | 'YEAR';

export const Leaderboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>('WEEK');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
        setLoading(true);
        const data = await getUsers();
        setUsers(data);
        setLoading(false);
    };
    loadUsers();
  }, []);

  // Helpers de Data
  const getStartDate = (frame: Timeframe): Date => {
    const now = new Date();
    const d = new Date(now); // Clone

    if (frame === 'WEEK') {
      // Ajustar para a última segunda-feira
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      d.setDate(diff);
    } else if (frame === 'MONTH') {
      d.setDate(1);
    } else if (frame === 'YEAR') {
      d.setMonth(0);
      d.setDate(1);
    }
    
    // Zerar horas para comparação justa
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const calculatePeriodStats = (user: User, start: Date) => {
    // Filtra check-ins após a data de início
    const validCheckIns = user.checkIns.filter(c => {
      // checkIn.date é YYYY-MM-DD. Adicionamos T12:00 para evitar problemas de fuso
      const checkInDate = new Date(`${c.date}T12:00:00`);
      return checkInDate >= start;
    });

    // Recalcula Score baseado apenas nesses check-ins
    const score = validCheckIns.reduce((acc, curr) => {
      const points = isWeekend(curr.date) ? 20 : 10;
      return acc + points;
    }, 0);

    return {
      score,
      count: validCheckIns.length,
      checkIns: validCheckIns
    };
  };

  // Dados processados
  const leaderboardData = useMemo(() => {
    const startDate = getStartDate(timeframe);

    return users.map(u => {
      const stats = calculatePeriodStats(u, startDate);
      return {
        ...u,
        periodScore: stats.score,
        periodCount: stats.count
      };
    }).sort((a, b) => {
        // Ordena por Score do Período, desempata por quantidade de treinos
        return (b.periodScore - a.periodScore) || (b.periodCount - a.periodCount);
    });
  }, [timeframe, users]);

  // Atleta da Semana (Separado para ficar sempre fixo no topo, independente da aba selecionada)
  const athleteOfTheWeek = useMemo(() => {
    const startDate = getStartDate('WEEK');
    
    const ranked = users.map(u => {
        const stats = calculatePeriodStats(u, startDate);
        return { ...u, periodScore: stats.score, periodCount: stats.count };
    }).sort((a, b) => (b.periodScore - a.periodScore) || (b.periodCount - a.periodCount));

    // Só retorna se tiver alguém com pontuação > 0
    return ranked[0]?.periodScore > 0 ? ranked[0] : null;
  }, [users]);

  if (loading && users.length === 0) {
      return <div className="text-center py-20 text-slate-500">Calculando ranking...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">Ranking da Academia</h2>
        <p className="text-slate-400 text-sm">Quem está focada no resultado?</p>
      </div>

      {/* Quadro de Honra - Atleta da Semana */}
      {athleteOfTheWeek ? (
        <div className="relative bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-3xl p-1 shadow-2xl border border-yellow-500/50">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-black text-xs px-4 py-1 rounded-full uppercase tracking-widest shadow-lg z-10">
                🏆 Atleta da Semana
            </div>
            
            <div className="bg-slate-900/90 rounded-[22px] p-6 flex items-center gap-5 backdrop-blur-sm relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 blur-[50px] rounded-full pointer-events-none"></div>

                <div className="relative">
                    <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-b from-yellow-300 to-amber-600">
                        <img 
                            src={athleteOfTheWeek.customAvatar || `https://picsum.photos/seed/${athleteOfTheWeek.avatarSeed}/200`} 
                            className="w-full h-full rounded-full object-cover border-4 border-slate-900"
                            alt={athleteOfTheWeek.name}
                        />
                    </div>
                    <div className="absolute -bottom-2 -right-1 text-2xl drop-shadow-md">🥇</div>
                </div>

                <div className="flex-1 z-10">
                    <h3 className="text-xl font-bold text-white leading-tight">{athleteOfTheWeek.name}</h3>
                    <p className="text-yellow-500 font-medium text-sm mb-2">Dominando o Ranking!</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
                            ⚡ {athleteOfTheWeek.periodScore} XP
                        </span>
                        <span className="bg-slate-800 px-2 py-1 rounded-md border border-slate-700">
                            🏋️ {athleteOfTheWeek.periodCount} Treinos
                        </span>
                    </div>
                </div>
            </div>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-2xl p-6 text-center border border-slate-700 border-dashed">
            <p className="text-slate-400 text-sm">A semana está começando! Quem será a primeira a pontuar?</p>
        </div>
      )}

      {/* Seletor de Período */}
      <div className="bg-slate-900 p-1 rounded-xl flex border border-slate-800 relative">
        {(['WEEK', 'MONTH', 'YEAR'] as Timeframe[]).map((t) => {
            const labels = { WEEK: 'Semanal', MONTH: 'Mensal', YEAR: 'Anual' };
            const isActive = timeframe === t;
            return (
                <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 relative z-10 ${
                        isActive 
                        ? 'text-white shadow-lg' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    {labels[t]}
                </button>
            );
        })}
        {/* Animated Background Pill */}
        <div 
            className="absolute top-1 bottom-1 bg-brand-primary rounded-lg transition-all duration-300 ease-out z-0"
            style={{
                width: '32%', // Approx 1/3 minus padding
                left: timeframe === 'WEEK' ? '1%' : timeframe === 'MONTH' ? '34%' : '67%'
            }}
        />
      </div>

      {/* Lista do Ranking */}
      <div className="space-y-3">
        {leaderboardData.map((u, index) => {
            const isTop3 = index < 3;
            const score = u.periodScore; // Score do período selecionado
            const count = u.periodCount; // Count do período selecionado
            
            // Cores do Ranking
            let rankColor = "text-slate-500";
            let borderColor = "border-slate-800";
            let icon = null;

            if (index === 0) {
                rankColor = "text-yellow-400";
                borderColor = "border-yellow-500/50";
                icon = "👑";
            } else if (index === 1) {
                rankColor = "text-slate-300";
                borderColor = "border-slate-500/50";
                icon = "🥈";
            } else if (index === 2) {
                rankColor = "text-amber-700";
                borderColor = "border-amber-700/50";
                icon = "🥉";
            }

            return (
                <div 
                    key={u.id} 
                    className={`flex items-center p-4 rounded-2xl border transition-all duration-300 ${
                        isTop3 
                            ? `bg-slate-800/80 ${borderColor} shadow-lg` 
                            : 'bg-transparent border-slate-800 hover:bg-slate-800/30'
                    }`}
                >
                    <div className={`w-8 font-black text-xl mr-3 text-center flex flex-col items-center justify-center ${rankColor}`}>
                        <span>{index + 1}</span>
                    </div>
                    
                    <div className="relative mr-4">
                        <img 
                            src={u.customAvatar || `https://picsum.photos/seed/${u.avatarSeed}/100`} 
                            className={`w-12 h-12 rounded-full object-cover bg-slate-700 border-2 ${index === 0 ? 'border-yellow-400' : 'border-slate-600'}`}
                            alt={u.name}
                        />
                        {icon && <div className="absolute -top-2 -right-1 text-base shadow-sm">{icon}</div>}
                    </div>

                    <div className="flex-1">
                        <div className="flex justify-between items-center pr-2">
                             <h3 className={`font-bold text-base leading-tight ${isTop3 ? 'text-white' : 'text-slate-300'}`}>
                                {u.name}
                             </h3>
                             <span className={`text-xl font-black ${isTop3 ? 'text-white' : 'text-slate-500'}`}>
                                {score} <span className="text-[10px] text-slate-600 font-normal uppercase">XP</span>
                             </span>
                        </div>
                        
                        <div className="flex items-center mt-1 space-x-3 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 5v14M18 5v14M2 12h20"/></svg>
                                {count} treinos
                            </span>
                            {u.streak > 0 && (
                                <span className="flex items-center gap-1 text-brand-accent/80">
                                    🔥 Streak atual: {u.streak}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )
        })}
        
        {leaderboardData.every(u => u.periodScore === 0) && (
            <div className="text-center py-8 opacity-50">
                <p>Nenhum treino registrado neste período.</p>
            </div>
        )}
      </div>
    </div>
  );
};