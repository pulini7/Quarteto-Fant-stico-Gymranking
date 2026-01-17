import React, { useState, useEffect } from 'react';
import { getAllCheckIns, toggleCheckInLike, addComment, getUsersLight } from '../services/storageService';
import { User, CheckIn } from '../types';

interface FeedProps {
    currentUser: User;
}

export const Feed: React.FC<FeedProps> = ({ currentUser }) => {
  const [feedData, setFeedData] = useState<{ user: User, checkIn: CheckIn }[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        const [checkIns, users] = await Promise.all([
            getAllCheckIns(),
            getUsersLight()
        ]);

        setFeedData(checkIns);
        setAllUsers(users);
        setLoading(false);
    };
    loadData();
  }, [refreshTrigger]);

  const handleLike = async (checkInId: string) => {
    // Toca um som de satisfação sutil (opcional, simulado visualmente)
    await toggleCheckInLike(checkInId, currentUser.id);
    setRefreshTrigger(prev => prev + 1);
  };

  const handlePostComment = async (checkInId: string) => {
    const text = commentInputs[checkInId];
    if (!text || !text.trim()) return;

    await addComment(checkInId, currentUser.id, text);
    setCommentInputs(prev => ({ ...prev, [checkInId]: '' }));
    setExpandedComments(prev => ({ ...prev, [checkInId]: true }));
    setRefreshTrigger(prev => prev + 1);
  };

  const toggleComments = (checkInId: string) => {
    setExpandedComments(prev => ({ ...prev, [checkInId]: !prev[checkInId] }));
  };

  const handleShare = async (checkIn: CheckIn, userName: string) => {
    const shareUrl = `${window.location.origin}/post/${checkIn.id}`;
    const shareText = `🔥 ${userName} acabou de treinar no Quarteto Fantástico GymRank! "${checkIn.caption || 'Foco total!'}"`;

    if (navigator.share) {
        try {
            await navigator.share({ title: 'GymRank Check-in', text: shareText, url: shareUrl });
        } catch (error) { console.log('User cancelled share'); }
    } else {
        try {
            await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
            alert('Link copiado!');
        } catch (err) { console.error('Failed to copy', err); }
    }
  };

  const getUserName = (id: string) => {
    const u = allUsers.find(user => user.id === id);
    return u ? u.name : 'Desconhecido';
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

  if (loading && feedData.length === 0) {
      return <div className="text-center py-10 text-slate-500">Carregando feed...</div>;
  }

  const reactions = [
      { id: 'muscle', icon: '💪', label: 'Força' },
      { id: 'fire', icon: '🔥', label: 'Brabo' },
      { id: 'chicken', icon: '🐔', label: 'Frango' }, // Zuera
      { id: 'goat', icon: '🐐', label: 'GOAT' }
  ];

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
        <div className="space-y-8">
          {feedData.map(({ user, checkIn }) => {
            const likes = checkIn.likes || [];
            const comments = checkIn.comments || [];
            const isLiked = likes.includes(currentUser.id);
            const isCommentsOpen = expandedComments[checkIn.id];

            return (
                <div key={checkIn.id} className="bg-brand-card rounded-3xl border border-slate-700 overflow-hidden shadow-xl">
                    <div className="p-4 flex items-center space-x-3">
                        <img 
                            src={user.customAvatar || `https://picsum.photos/seed/${user.avatarSeed}/100`} 
                            className="w-10 h-10 rounded-full object-cover border border-slate-600"
                            alt={user.name}
                            loading="lazy"
                        />
                        <div>
                            <h3 className="font-bold text-white text-sm">{user.name}</h3>
                            <p className="text-xs text-slate-400">{formatTime(checkIn.timestamp)}</p>
                        </div>
                    </div>
                    
                    <div className="w-full bg-black aspect-square md:aspect-video relative group">
                        {checkIn.photo ? (
                            <img src={checkIn.photo} alt="Workout" className="w-full h-full object-contain" loading="lazy" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-xs">Sem foto</div>
                        )}
                        {/* Double tap hint could go here */}
                    </div>

                    <div className="p-4 bg-slate-800/50">
                        {/* Custom Reactions Bar */}
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex bg-slate-900/80 rounded-full p-1 border border-slate-700 shadow-inner">
                                {reactions.map(r => (
                                    <button 
                                        key={r.id}
                                        onClick={() => handleLike(checkIn.id)}
                                        className={`w-9 h-9 flex items-center justify-center rounded-full text-lg transition-all active:scale-90 hover:bg-slate-700
                                            ${isLiked ? 'opacity-100 grayscale-0 scale-110' : 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100'}
                                        `}
                                        title={r.label}
                                    >
                                        {r.icon}
                                    </button>
                                ))}
                            </div>

                            <div className="flex space-x-3">
                                <button onClick={() => toggleComments(checkIn.id)} className="text-slate-400 hover:text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                </button>
                                <button onClick={() => handleShare(checkIn, getUserName(checkIn.user?.id || ''))} className="text-slate-400 hover:text-brand-primary">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
                                </button>
                            </div>
                        </div>
                        
                        <div className="text-sm mb-2 font-medium text-white flex items-center gap-1">
                            {likes.length > 0 && (
                                <>
                                    <span className="text-brand-accent">💪</span>
                                    <span>{likes.length} reações</span>
                                </>
                            )}
                        </div>

                        {checkIn.caption && (
                            <div className="mb-3 text-sm">
                                <span className="font-bold text-white mr-2">{user.name}</span>
                                <span className="text-slate-300">{checkIn.caption}</span>
                            </div>
                        )}

                        {isCommentsOpen && (
                            <div className="mt-4 pt-4 border-t border-slate-700/50 animate-fade-in">
                                <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
                                    {comments.length === 0 ? (
                                        <p className="text-xs text-slate-500 italic">Seja a primeira a comentar...</p>
                                    ) : (
                                        comments.map((comment) => (
                                            <div key={comment.id} className="text-sm">
                                                <span className="font-bold text-slate-300 mr-2">{getUserName(comment.userId)}</span>
                                                <span className="text-slate-400">{comment.text}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="Adicionar comentário..." className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-primary" value={commentInputs[checkIn.id] || ''} onChange={(e) => setCommentInputs(prev => ({...prev, [checkIn.id]: e.target.value}))} onKeyPress={(e) => e.key === 'Enter' && handlePostComment(checkIn.id)} />
                                    <button onClick={() => handlePostComment(checkIn.id)} disabled={!commentInputs[checkIn.id]} className="text-brand-primary font-bold text-sm disabled:opacity-50">Enviar</button>
                                </div>
                            </div>
                        )}

                        {!isCommentsOpen && comments.length > 0 && (
                             <button onClick={() => toggleComments(checkIn.id)} className="text-xs text-slate-500 mt-2">Ver todos os {comments.length} comentários</button>
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