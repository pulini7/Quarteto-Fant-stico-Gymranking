import React, { useMemo, useState, useEffect } from 'react';
import { getLeaderboardData, isWeekend, resetGlobalRanking } from '../services/storageService';
import { User } from '../types';
import { Button } from './Button';

type Timeframe = 'WEEK' | 'MONTH' | 'YEAR';

export const Leaderboard: React.FC = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>('WEEK');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    // OPTIMIZATION: Uses data without base64 photos
    const data = await getLeaderboardData();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleGlobalReset = async () => {
    if (window.confirm("ATENÇÃO: Isso zerará a pontuação E OS STREAKS de TODOS os usuários! Os check-ins (histórico) serão mantidos. Tem certeza?")) {
        setResetting(true);
        await resetGlobalRanking();
        await loadUsers(); // Reload to show 0
        setResetting(false);
        alert("Ranking e Streaks zerados com sucesso!");
    }
  };

  const getStartDate = (frame: Timeframe): Date => {
    const now = new Date();
    const d = new Date(now); 

    if (frame === 'WEEK') {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
    } else if (frame === 'MONTH') {
      d.setDate(1);
    } else if (frame === 'YEAR') {
      d.setMonth(0);
      d.setDate(1);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const calculatePeriodStats = (user: User, start: Date) => {
    // Uses lightweight checkIns (date only)
    const validCheckIns = user.checkIns.filter(c => {
      const checkInDate = new Date(`${c.date}T12:00:00`);
      return checkInDate >= start;
    });

    // Simples: 1 Checkin = 1 Ponto
    const score = validCheckIns.length; 

    return {
      score,
      count: validCheckIns.length
    };
  };

  const leaderboardData = useMemo(() => {
    const startDate = getStartDate(timeframe);

    return users
      .map(u => {
        const stats = calculatePeriodStats(u, startDate);
        // Se quisermos usar o score global do banco (que agora é 1 ponto por checkin desde o reset), usamos u.score
        // Mas para filtros de tempo (Semana/Mês), usamos o calculado dinamicamente
        return {
          ...u,
          periodScore: stats.score,
          periodCount: stats.count
        };
      }).sort((a, b) => {
          return (b.periodScore - a.periodScore) || (b.periodCount - a.periodCount);
      });
  }, [timeframe, users]);

  const athleteOfTheWeek = useMemo(() => {
    const startDate = getStartDate('WEEK');
    const ranked = users
        .map(u => {
            const stats = calculatePeriodStats(u, startDate);
            return { ...u, periodScore: stats.score, periodCount: stats.count };
        }).sort((a, b) => (b.periodScore - a.periodScore) || (b.periodCount - a.periodCount));
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

      {athleteOfTheWeek ? (
        <div className="relative bg-gradient-to-br from-yellow-500/20 to-amber-600/20 rounded-3xl p-1 shadow-2xl border border-yellow-500/50">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black font-black text-xs px-4 py-1 rounded-full uppercase tracking-widest shadow-lg z-10">🏆 Atleta da Semana</div>
            <div className="bg-slate-900/90 rounded-[22px] p-6 flex items-center gap-5 backdrop-blur-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/20 blur-[50px] rounded-full pointer-events-none"></div>
                <div className="relative">
                    <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-b from-yellow-300 to-amber-600">
                        <img src={athleteOfTheWeek.customAvatar || `https://picsum.photos/seed/${athleteOfTheWeek.avatarSeed}/200`} className="w-full h-full rounded-full object-cover border-4 border-slate-900" alt={athleteOfTheWeek.name} loading="lazy"/>
                    </div>
                    <div className="absolute -bottom-2 -right-1 text-2xl drop-shadow-md">🥇</div>
                </div>
                <div className="flex-1 z-10">
                    <h3 className="text-xl font-bold text-white leading-tight">{athleteOfTheWeek.name}</h3>
                    <p className="text-yellow-500 font-medium text-sm mb-2">Dominando o Ranking!</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="bg-slate-800 px-2 py-1 rounded-md border border-slate-700">⚡ {athleteOfTheWeek.periodScore} Pts</span>
                        <span className="bg-slate-800 px-2 py-1 rounded-md border border-slate-700">🏋️ {athleteOfTheWeek.periodCount} Treinos</span>
                    </div>
                </div>
            </div>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-2xl p-6 text-center border border-slate-700 border-dashed">
            <p className="text-slate-400 text-sm">A semana está começando! Quem será a primeira a pontuar?</p>
        </div>
      )}

      <div className="bg-slate-900 p-1 rounded-xl flex border border-slate-800 relative">
        {(['WEEK', 'MONTH', 'YEAR'] as Timeframe[]).map((t) => {
            const labels = { WEEK: 'Semanal', MONTH: 'Mensal', YEAR: 'Anual' };
            const isActive = timeframe === t;
            return (
                <button key={t} onClick={() => setTimeframe(t)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 relative z-10 ${isActive ? 'text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                    {labels[t]}
                </button>
            );
        })}
        <div className="absolute top-1 bottom-1 bg-brand-primary rounded-lg transition-all duration-300 ease-out z-0" style={{ width: '32%', left: timeframe === 'WEEK' ? '1%' : timeframe === 'MONTH' ? '34%' : '67%' }} />
      </div>

      <div className="space-y-3">
        {leaderboardData.map((u, index) => {
            const score = u.periodScore; 
            const count = u.periodCount; 
            
            // LÓGICA DE EMPATE TÉCNICO:
            // Procura o índice do primeiro usuário com a mesma pontuação e contagem
            const effectiveRank = leaderboardData.findIndex(p => p.periodScore === score && p.periodCount === count) + 1;
            const isTop3 = effectiveRank <= 3;

            let rankColor = "text-slate-500";
            let borderColor = "border-slate-800";
            let icon = null;

            if (effectiveRank === 1) { rankColor = "text-yellow-400"; borderColor = "border-yellow-500/50"; icon = "👑"; } 
            else if (effectiveRank === 2) { rankColor = "text-slate-300"; borderColor = "border-slate-500/50"; icon = "🥈"; } 
            else if (effectiveRank === 3) { rankColor = "text-amber-700"; borderColor = "border-amber-700/50"; icon = "🥉"; }

            return (
                <div key={u.id} className={`flex items-center p-4 rounded-2xl border transition-all duration-300 ${isTop3 ? `bg-slate-800/80 ${borderColor} shadow-lg` : 'bg-transparent border-slate-800 hover:bg-slate-800/30'}`}>
                    <div className={`w-8 font-black text-xl mr-3 text-center flex flex-col items-center justify-center ${rankColor}`}>
                        <span>{effectiveRank}</span>
                    </div>
                    <div className="relative mr-4">
                        <img src={u.customAvatar || `https://picsum.photos/seed/${u.avatarSeed}/100`} className={`w-12 h-12 rounded-full object-cover bg-slate-700 border-2 ${effectiveRank === 1 ? 'border-yellow-400' : 'border-slate-600'}`} alt={u.name} loading="lazy" />
                        {icon && <div className="absolute -top-2 -right-1 text-base shadow-sm">{icon}</div>}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center pr-2">
                             <div>
                                <h3 className={`font-bold text-base leading-tight ${isTop3 ? 'text-white' : 'text-slate-300'}`}>{u.name}</h3>
                             </div>
                             <div className="flex items-center gap-4">
                                <div className="text-right flex flex-col items-end">
                                    <span className={`font-bold text-sm ${isTop3 ? 'text-slate-200' : 'text-slate-400'}`}>{count}</span>
                                    <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Treinos</span>
                                </div>
                                <div className="w-px h-6 bg-slate-700"></div>
                                <div className="text-right flex flex-col items-end min-w-[3rem]">
                                    <span className={`text-xl font-black leading-none ${isTop3 ? 'text-white' : 'text-slate-500'}`}>{score}</span>
                                    <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Pts</span>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            )
        })}
        {leaderboardData.every(u => u.periodScore === 0) && (
            <div className="text-center py-8 opacity-50"><p>Nenhum treino registrado neste período.</p></div>
        )}
      </div>

      <div className="pt-8 border-t border-slate-800 mt-8 text-center">
          <Button 
            onClick={handleGlobalReset} 
            variant="secondary" 
            className="text-xs bg-red-900/20 text-red-400 hover:bg-red-900 hover:text-white border-red-900/50"
            disabled={resetting}
          >
            {resetting ? 'Resetando...' : '⚠️ Resetar Ranking (Admin)'}
          </Button>
      </div>
    </div>
  );
};