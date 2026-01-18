import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { getAllCheckIns, toggleCheckInLike, addComment, deleteCheckIn, addVideoToCheckIn } from '../services/storageService';
import { User, CheckIn } from '../types';
import { playSound } from '../services/soundService';

interface FeedProps {
    currentUser: User;
}

// --- VISUAL COMPONENTS ---

// Skeleton Loader para melhor percepção de performance
const PostSkeleton = () => (
    <div className="bg-brand-card rounded-3xl border border-slate-700 overflow-hidden shadow-xl mb-8 animate-pulse">
        <div className="p-4 flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-slate-700"></div>
            <div className="space-y-2">
                <div className="h-3 w-24 bg-slate-700 rounded"></div>
                <div className="h-2 w-16 bg-slate-800 rounded"></div>
            </div>
        </div>
        <div className="w-full aspect-square bg-slate-800"></div>
        <div className="p-4 space-y-3">
            <div className="h-8 w-full bg-slate-800 rounded-full"></div>
            <div className="h-3 w-3/4 bg-slate-800 rounded"></div>
        </div>
    </div>
);

// Imagem em tela cheia (Zoom)
const ImageLightbox: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-2 animate-fade-in" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full z-10">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
            <img 
                src={src} 
                alt="Full size" 
                className="max-w-full max-h-screen object-contain rounded-lg shadow-2xl transition-transform duration-300"
                onClick={(e) => e.stopPropagation()} 
            />
        </div>
    );
};

// --- LOGIC COMPONENTS ---
const SUPER_ADMIN_EMAIL = 'vitor_pulini@hotmail.com';

const FeedPost = memo(({ 
    checkIn, 
    user, 
    currentUser, 
    onLike, 
    onPostComment,
    onDelete,
    onImageClick,
    onVideoUpload
}: { 
    checkIn: CheckIn, 
    user: User, 
    currentUser: User, 
    onLike: (id: string) => void, 
    onPostComment: (id: string, text: string) => void,
    onDelete: (id: string) => void,
    onImageClick: (src: string) => void,
    onVideoUpload: (id: string, file: File) => void
}) => {
    const [commentText, setCommentText] = useState('');
    const [isCommentsOpen, setIsCommentsOpen] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    
    // Double Tap Logic
    const lastClickRef = useRef<number>(0);

    const likes = checkIn.likes || [];
    const comments = checkIn.comments || [];
    const videos = checkIn.videos || [];
    
    const isLiked = likes.includes(currentUser.id);
    const isOwner = currentUser.id === user.id;
    const canDelete = isOwner || currentUser.name === SUPER_ADMIN_EMAIL || currentUser.isAdmin;

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        
        if (diffMins < 1) return 'Agora mesmo';
        if (diffMins < 60) return `${diffMins} min`;
        if (diffHours < 24) return `${diffHours} h`;
        return `${date.getDate()}/${date.getMonth() + 1}`;
    };

    const handleCommentSubmit = () => {
        if (commentText.trim()) {
            onPostComment(checkIn.id, commentText);
            setCommentText('');
            setIsCommentsOpen(true);
        }
    }

    const handleShare = async () => {
        playSound.click();
        const shareData = {
            title: `Treino de ${user.name} no GymRanking`,
            text: `Confira o check-in de ${user.name}: "${checkIn.caption || 'Foco total!'}"`,
            url: `${window.location.origin}?post=${checkIn.id}`
        };

        if (navigator.share) {
            try { await navigator.share(shareData); } catch (err) { /* ignore */ }
        } else {
            try {
                await navigator.clipboard.writeText(`${shareData.text} \n${shareData.url}`);
                setShareSuccess(true);
                setTimeout(() => setShareSuccess(false), 2000);
            } catch (err) { console.error(err); }
        }
    };

    const toggleLike = () => {
        if (!isLiked) {
            playSound.click(); // Standard click sound
        }
        onLike(checkIn.id);
    };

    const handleImageClick = (e: React.MouseEvent) => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;

        if (now - lastClickRef.current < DOUBLE_TAP_DELAY) {
            // Double Tap Detected
            if (!isLiked) {
                toggleLike();
            }
            setShowHeartAnimation(true);
            setTimeout(() => setShowHeartAnimation(false), 1000);
            playSound.success(); // Satisfying pop sound
        } else {
            onImageClick(checkIn.photo);
        }
        lastClickRef.current = now;
    };

    const handleDelete = () => {
        if (window.confirm("Tem certeza que deseja apagar este post?")) {
            onDelete(checkIn.id);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // EXCELLENT QUALITY: Limite aumentado para 150MB para suportar vídeos em alta resolução
            if (file.size > 150 * 1024 * 1024) { 
                alert("O vídeo é muito grande! O limite é 150MB.");
                return;
            }
            onVideoUpload(checkIn.id, file);
        }
    }
    
    return (
        <div className="bg-brand-card rounded-3xl border border-slate-700 overflow-hidden shadow-xl mb-8 relative">
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 to-brand-primary">
                        <img 
                            src={user.customAvatar || `https://picsum.photos/seed/${user.avatarSeed}/100`} 
                            className="w-9 h-9 rounded-full object-cover border-2 border-brand-card"
                            alt={user.name}
                            loading="lazy"
                        />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm leading-none mb-1">{user.name}</h3>
                        <p className="text-[10px] text-slate-400 font-medium">{formatTime(checkIn.timestamp)} • Treino</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Botão de Adicionar Vídeo (Só para o Dono) */}
                    {isOwner && (
                        <label className="text-slate-500 hover:text-brand-accent p-2 cursor-pointer transition-colors" title="Gravar Vídeo">
                            <input 
                                type="file" 
                                accept="video/*" 
                                capture="environment" 
                                className="hidden" 
                                onChange={handleFileSelect}
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/><path d="M12 12h.01"/></svg>
                        </label>
                    )}

                    {/* Botão de Deletar (Dono ou Super Admin) */}
                    {canDelete && (
                        <button onClick={handleDelete} className="text-slate-500 hover:text-red-500 p-2 transition-colors" title="Apagar Post">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                        </button>
                    )}
                </div>
            </div>
            
            <div className="w-full bg-black relative group">
                {/* Main Photo */}
                <div className="aspect-square md:aspect-video relative cursor-pointer" onClick={handleImageClick}>
                    {checkIn.photo ? (
                        <img src={checkIn.photo} alt="Workout" className="w-full h-full object-contain" loading="lazy" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-xs">Sem foto</div>
                    )}
                    
                    {/* Big Heart Animation Overlay */}
                    {showHeartAnimation && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 animate-ping-short">
                            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="white" stroke="none" className="drop-shadow-2xl opacity-90"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </div>
                    )}
                </div>

                {/* Video Carousel/Grid if videos exist */}
                {videos.length > 0 && (
                    <div className="flex overflow-x-auto gap-2 p-2 bg-slate-900 scrollbar-thin scrollbar-thumb-brand-primary">
                        {videos.map((vid, idx) => (
                            <div key={idx} className="min-w-[150px] w-[150px] aspect-[9/16] bg-black rounded-lg overflow-hidden border border-slate-700 relative shadow-md">
                                <video src={vid} controls className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-4 bg-slate-800/30">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={(e) => { e.stopPropagation(); toggleLike(); }}
                            className={`flex items-center gap-1.5 transition-all active:scale-90 ${isLiked ? 'text-red-500' : 'text-slate-200 hover:text-white'}`}
                        >
                             <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isLiked ? "0" : "2"} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </button>
                        
                        <button 
                             onClick={() => setIsCommentsOpen(!isCommentsOpen)} 
                             className="text-slate-200 hover:text-white transition-all active:scale-90"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </button>

                        <button 
                            onClick={handleShare} 
                            className={`text-slate-200 hover:text-white transition-all active:scale-90 ${shareSuccess ? 'text-brand-accent' : ''}`}
                        >
                            {shareSuccess ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
                            )}
                        </button>
                    </div>
                </div>
                
                <div className="text-sm font-bold text-white mb-2">
                    {likes.length} {likes.length === 1 ? 'curtida' : 'curtidas'}
                </div>

                <div className="mb-2 text-sm">
                    <span className="font-bold text-white mr-2">{user.name}</span>
                    <span className="text-slate-300 leading-relaxed break-words">{checkIn.caption}</span>
                </div>

                {!isCommentsOpen && comments.length > 0 && (
                    <button onClick={() => setIsCommentsOpen(true)} className="text-sm text-slate-500 mb-2">
                        Ver todos os {comments.length} comentários
                    </button>
                )}

                {isCommentsOpen && (
                    <div className="mt-2 animate-fade-in">
                        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                            {comments.map((comment) => (
                                <div key={comment.id} className="text-sm flex gap-2">
                                    <span className="font-bold text-slate-300 text-xs mt-0.5">Usuário</span>
                                    <span className="text-slate-400 leading-snug">{comment.text}</span>
                                </div>
                            ))}
                            {comments.length === 0 && <p className="text-xs text-slate-600 italic">Nenhum comentário ainda.</p>}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 items-center mt-3 pt-3 border-t border-slate-700/50">
                    <img src={currentUser.customAvatar || `https://picsum.photos/seed/${currentUser.avatarSeed}/50`} className="w-7 h-7 rounded-full object-cover" alt="Me" />
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            placeholder="Adicione um comentário..." 
                            className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-slate-600" 
                            value={commentText} 
                            onChange={(e) => setCommentText(e.target.value)} 
                            onKeyPress={(e) => e.key === 'Enter' && handleCommentSubmit()} 
                        />
                    </div>
                    {commentText && (
                        <button onClick={handleCommentSubmit} className="text-brand-primary font-bold text-xs uppercase hover:text-blue-400">
                            Publicar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

export const Feed: React.FC<FeedProps> = ({ currentUser }) => {
  const [feedData, setFeedData] = useState<{ user: User, checkIn: CheckIn }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  
  // Infinite Scroll State
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 5;

  // Refs
  const observer = useRef<IntersectionObserver | null>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  // --- TOUCH HANDLERS (Pull to Refresh) ---
  const handleTouchStart = (e: React.TouchEvent) => {
      if (window.scrollY === 0) {
          touchStartY.current = e.touches[0].clientY;
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      const currentY = e.touches[0].clientY;
      if (window.scrollY === 0 && currentY - touchStartY.current > 80) {
          setIsPulling(true);
      } else {
          setIsPulling(false);
      }
  };

  const handleTouchEnd = () => {
      if (isPulling) {
          playSound.success();
          setIsPulling(false);
          setLoading(true);
          setPage(0); // Force Refresh
          setRefreshTrigger(prev => prev + 1);
      }
  };

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting && hasMore) {
              setPage(prevPage => prevPage + 1);
          }
      });
      if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
        // If refreshing (page 0), show loading but don't clear data immediately to prevent flicker unless empty
        if (page === 0) setLoading(true);

        const newCheckIns = await getAllCheckIns(page, PAGE_SIZE);
        
        setFeedData(prev => {
            if (page === 0) return newCheckIns;
            const existingIds = new Set(prev.map(p => p.checkIn.id));
            const uniqueNew = newCheckIns.filter(p => !existingIds.has(p.checkIn.id));
            return [...prev, ...uniqueNew];
        });

        if (newCheckIns.length < PAGE_SIZE) setHasMore(false);
        else setHasMore(true);
        
        setLoading(false);
    };
    loadData();
  }, [page, refreshTrigger]);

  const handleLike = useCallback(async (checkInId: string) => {
    await toggleCheckInLike(checkInId, currentUser.id);
    // Optimistic update
    setFeedData(prev => prev.map(item => {
        if (item.checkIn.id === checkInId) {
            const likes = item.checkIn.likes || [];
            const newLikes = likes.includes(currentUser.id) 
                ? likes.filter(id => id !== currentUser.id)
                : [...likes, currentUser.id];
            return { ...item, checkIn: { ...item.checkIn, likes: newLikes } };
        }
        return item;
    }));
  }, [currentUser.id]);

  const handlePostComment = useCallback(async (checkInId: string, text: string) => {
    await addComment(checkInId, currentUser.id, text);
    // Simple local update for responsiveness (assuming success)
    setFeedData(prev => prev.map(item => {
        if (item.checkIn.id === checkInId) {
             const newComment = { id: Date.now().toString(), userId: currentUser.id, text, timestamp: new Date().toISOString() };
             return { ...item, checkIn: { ...item.checkIn, comments: [...(item.checkIn.comments || []), newComment] } };
        }
        return item;
    }));
  }, [currentUser.id]);

  const handleDeletePost = useCallback(async (checkInId: string) => {
      await deleteCheckIn(checkInId);
      playSound.error(); // Sound like trash bin
      setFeedData(prev => prev.filter(item => item.checkIn.id !== checkInId));
  }, []);

  const handleVideoUpload = useCallback(async (checkInId: string, file: File) => {
      setUploadingVideoId(checkInId);
      playSound.click();
      
      const reader = new FileReader();
      reader.onloadend = async () => {
          const base64 = reader.result as string;
          const success = await addVideoToCheckIn(checkInId, base64);
          if (success) {
              playSound.success();
              setFeedData(prev => prev.map(item => {
                  if (item.checkIn.id === checkInId) {
                      const existingVideos = item.checkIn.videos || [];
                      return { ...item, checkIn: { ...item.checkIn, videos: [...existingVideos, base64] } };
                  }
                  return item;
              }));
          } else {
              alert("Erro ao salvar vídeo. Tente novamente ou use um arquivo menor.");
          }
          setUploadingVideoId(null);
      };
      reader.readAsDataURL(file);
  }, []);

  return (
    <div 
        ref={feedContainerRef}
        className="space-y-4 animate-fade-in pb-20 min-h-screen"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
    >
      <style>{`
        @keyframes ping-short {
          0% { transform: scale(0.5); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-ping-short {
          animation: ping-short 0.6s cubic-bezier(0, 0, 0.2, 1) forwards;
        }
      `}</style>

      {/* Pull Refresh Indicator */}
      <div className={`fixed top-16 left-0 right-0 z-40 flex justify-center transition-all duration-300 ${isPulling ? 'translate-y-4 opacity-100' : '-translate-y-10 opacity-0'}`}>
          <div className="bg-brand-primary text-white px-4 py-2 rounded-full shadow-lg font-bold text-xs flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
             Solte para atualizar
          </div>
      </div>

      {uploadingVideoId && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-slate-800">
            <div className="h-full bg-brand-accent animate-pulse w-full"></div>
            <div className="absolute top-2 left-0 right-0 text-center text-xs font-bold text-brand-accent bg-black/50 py-1">Enviando vídeo...</div>
        </div>
      )}

      <div className="text-center mb-6 pt-2">
        <h2 className="text-2xl font-black italic tracking-tighter text-white">FEED DA GALERA</h2>
        <p className="text-slate-400 text-xs">Acompanhe a evolução do time</p>
      </div>

      {activeImage && <ImageLightbox src={activeImage} onClose={() => setActiveImage(null)} />}

      {/* Skeletons on Initial Load */}
      {loading && page === 0 && (
          <div className="space-y-8">
              <PostSkeleton />
              <PostSkeleton />
          </div>
      )}

      {feedData.length === 0 && !loading && (
        <div className="text-center py-20 text-slate-500 opacity-60">
            <div className="text-5xl mb-4 grayscale">📸</div>
            <p className="font-medium">Tudo calmo por aqui...</p>
            <p className="text-xs">Seja a primeira a postar hoje!</p>
        </div>
      )}
      
      <div className="space-y-2">
          {feedData.map(({ user, checkIn }, index) => {
            const isLast = feedData.length === index + 1;
            return (
                <div ref={isLast ? lastElementRef : null} key={checkIn.id}>
                    <FeedPost 
                        checkIn={checkIn}
                        user={user}
                        currentUser={currentUser}
                        onLike={handleLike}
                        onPostComment={handlePostComment}
                        onDelete={handleDeletePost}
                        onImageClick={setActiveImage}
                        onVideoUpload={handleVideoUpload}
                    />
                </div>
            );
          })}
      </div>
      
      {loading && page > 0 && (
          <div className="py-8 flex justify-center">
              <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
      )}
      
      {!hasMore && feedData.length > 5 && (
          <div className="text-center py-8">
              <span className="text-[10px] text-slate-700 font-bold uppercase tracking-widest border border-slate-800 px-3 py-1 rounded-full">Isso é tudo, pessoal!</span>
          </div>
      )}
    </div>
  );
};