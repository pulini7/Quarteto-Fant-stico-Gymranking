import React, { useState, useEffect } from 'react';
import { getAllCheckIns, toggleCheckInLike } from '../services/storageService';
import { User, CheckIn } from '../types';

interface FeedProps {
    currentUser: User;
}

export const Feed: React.FC<FeedProps> = ({ currentUser }) => {
  const [feedData, setFeedData] = useState<{ user: User, checkIn: CheckIn }[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setFeedData(getAllCheckIns());
  }, [refreshTrigger]);

  const handleLike = (checkInId: string) => {
    toggleCheckInLike(checkInId, currentUser.id);
    // Trigger a refresh to show updated like count
    setRefreshTrigger(prev => prev + 1);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays === 1) return `Ontem`;
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">Feed da Academia</h2>
        <p className="text-slate-400 text-sm">Acompanhe o foco da galera</p>
      </div>

      {feedData.length === 0 ? (
        <div className="text-center py-10 text-slate-500">
            <div className="text-4xl mb-3">📭</div>
            <p>Nenhum check-in registrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {feedData.map(({ user, checkIn }) => {
            const likes = checkIn.likes || [];
            const isLiked = likes.includes(currentUser.id);

            return (
                <div key={checkIn.id} className="bg-brand-card rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
                    <div className="p-4 flex items-center space-x-3">
                        <img 
                            src={user.customAvatar || `https://picsum.photos/seed/${user.avatarSeed}/100`} 
                            className="w-10 h-10 rounded-full object-cover border border-slate-600"
                            alt={user.name}
                        />
                        <div>
                            <h3 className="font-bold text-white text-sm">{user.name}</h3>
                            <p className="text-xs text-slate-400">{formatTime(checkIn.timestamp)}</p>
                        </div>
                    </div>
                    
                    <div className="w-full bg-black aspect-square md:aspect-video relative">
                        {checkIn.photo ? (
                            <img 
                                src={checkIn.photo} 
                                alt="Workout Proof" 
                                className="w-full h-full object-contain" 
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-xs">
                                Sem foto
                            </div>
                        )}
                        
                        {/* Double tap like effect could be added here later */}
                    </div>

                    <div className="p-4 bg-slate-800/50">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center text-brand-accent text-sm font-semibold">
                                <span className="mr-2">💪</span> 
                                <span>Treino Concluído</span>
                            </div>
                            
                            <button 
                                onClick={() => handleLike(checkIn.id)}
                                className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors group active:scale-95"
                            >
                                <span className={`transition-all duration-300 transform group-active:scale-125 ${isLiked ? 'text-brand-danger' : 'text-slate-400'}`}>
                                    {isLiked ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                                    )}
                                </span>
                                <span className="font-bold text-sm">{likes.length}</span>
                            </button>
                        </div>
                        
                        {checkIn.caption && (
                            <div className="mt-2 text-sm">
                                <span className="font-bold text-white mr-2">{user.name}</span>
                                <span className="text-slate-300">{checkIn.caption}</span>
                            </div>
                        )}
                    </div>
                </div>
            )
          })}
        </div>
      )}
    </div>
  );
};