import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { analyzeWorkoutImage } from '../services/geminiService';
import { playSound } from '../services/soundService';

interface CheckInModalProps {
  onConfirm: (photoBase64: string, caption: string) => void;
  onClose: () => void;
}

const MUSCLE_GROUPS = [
  "Peito", "Costas", "Bíceps", "Tríceps", 
  "Pernas", "Glúteos", "Panturrilha", "Abdômen", "Cardio"
];

export const CheckInModal: React.FC<CheckInModalProps> = ({ onConfirm, onClose }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
      isMountedRef.current = true;
      return () => { 
          isMountedRef.current = false; 
          stopCamera();
      };
  }, []);

  // Iniciar câmera ao montar ou mudar o modo (frontal/traseira)
  useEffect(() => {
    if (!preview) {
      startCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, preview]);

  const startCamera = async () => {
    stopCamera(); 
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          // Solicita Full HD/2K. 4K puro pode travar o navegador mobile em Base64.
          width: { ideal: 1920 }, 
          height: { ideal: 1080 }
        } 
      });
      
      if (!isMountedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Erro na câmera:", err);
      if (isMountedRef.current) {
          setCameraError("Não foi possível acessar a câmera em alta resolução.");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const takePhoto = async () => {
    playSound.camera(); 
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.readyState !== 4) return; 

      // --- ALGORITMO DE ALTA QUALIDADE OTIMIZADA ---
      // 1. Captura resolução nativa
      let width = video.videoWidth;
      let height = video.videoHeight;

      // 2. Limita a 2048px (2K) no maior lado para não gerar Base64 > 5MB que falha no banco
      const MAX_DIMENSION = 2048; 
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = width / height;
          if (width > height) {
              width = MAX_DIMENSION;
              height = Math.round(MAX_DIMENSION / ratio);
          } else {
              height = MAX_DIMENSION;
              width = Math.round(MAX_DIMENSION * ratio);
          }
      }

      canvas.width = width;
      canvas.height = height;
      
      const context = canvas.getContext('2d');
      if (context) {
        // Espelhar horizontalmente se for câmera frontal
        if (facingMode === 'user') {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }
        
        context.drawImage(video, 0, 0, width, height);
        
        // JPEG 0.85 é visualmente indistinguível de 1.0 em telas mobile, 
        // mas o arquivo é 80% menor, garantindo que o upload funcione.
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        if (isMountedRef.current) {
            setPreview(dataUrl);
            stopCamera();
            setAnalyzing(true);
        }

        // --- OTIMIZAÇÃO PARA IA ---
        // Cria uma versão pequena (500px) apenas para a IA analisar rápido
        // Isso economiza banda e tokens, deixando o app mais rápido
        const smallCanvas = document.createElement('canvas');
        const scale = 500 / Math.max(width, height);
        smallCanvas.width = width * scale;
        smallCanvas.height = height * scale;
        const smallCtx = smallCanvas.getContext('2d');
        if (smallCtx) {
             smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
             const smallDataUrl = smallCanvas.toDataURL('image/jpeg', 0.6);
             
             analyzeWorkoutImage(smallDataUrl).then((suggestion) => {
                 if (!isMountedRef.current) return; 
                 if (suggestion) {
                     setCaption(prev => {
                         if (prev.length > 5) return prev; 
                         return suggestion;
                     });
                     if (!isSubmitting) playSound.success(); 
                 }
                 setAnalyzing(false);
            }).catch(() => {
                if (isMountedRef.current) setAnalyzing(false);
            });
        } else {
            setAnalyzing(false);
        }
      }
    }
  };

  const retakePhoto = () => {
    setPreview(null);
    setCaption('');
    setSelectedTags([]);
    setAnalyzing(false);
  };

  const toggleCamera = () => {
    playSound.click();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const toggleTag = (tag: string) => {
    playSound.click();
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (preview && !isSubmitting) {
        setIsSubmitting(true);
        playSound.success();
        
        try {
            let finalCaption = caption.trim();
            if (selectedTags.length > 0) {
                const tagsString = selectedTags.map(t => `#${t}`).join(' ');
                finalCaption = finalCaption ? `${finalCaption}\n\n${tagsString}` : tagsString;
            }

            await onConfirm(preview, finalCaption);
        } catch (error) {
            console.error("Erro no envio:", error);
            alert("Erro ao enviar. A foto pode ser muito grande ou a internet oscilou.");
            setIsSubmitting(false);
        }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="bg-brand-card w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-white">Prova de Treino (HD) 📸</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center justify-start space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
          {!preview ? (
            <div className="w-full flex flex-col items-center space-y-4">
                <div className="relative w-full aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-lg border-2 border-slate-700">
                    {cameraError ? (
                        <div className="absolute inset-0 flex items-center justify-center text-center p-4 text-brand-danger">
                            {cameraError}
                        </div>
                    ) : (
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted
                            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
                        />
                    )}
                    
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center space-x-8">
                        <button 
                            onClick={toggleCamera} 
                            className="p-3 bg-slate-800/60 backdrop-blur text-white rounded-full hover:bg-slate-700/80 transition-all active:scale-95 border border-white/10"
                            title="Trocar Câmera"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0-4.418-3.582-8-8-8S4 5.582 4 10"/><path d="M4 14c0 4.418 3.582 8 8 8s8-3.582 8-8"/><path d="M10 2 8 4h4Z"/><path d="m14 22 2-2h-4Z"/></svg>
                        </button>

                        <button 
                            onClick={takePhoto} 
                            className="w-16 h-16 rounded-full border-4 border-white bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-90 shadow-lg"
                        >
                            <div className="w-12 h-12 bg-brand-primary rounded-full shadow-inner"></div>
                        </button>

                         <div className="w-12"></div>
                    </div>
                </div>
                <p className="text-xs text-slate-500 text-center">Tire uma foto sua ou dos equipamentos (Alta Resolução).</p>
                <canvas ref={canvasRef} hidden />
            </div>
          ) : (
            <div className="w-full space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-slate-600 shadow-lg bg-black">
                    <img src={preview} alt="Proof" className="w-full h-auto max-h-[40vh] object-contain mx-auto" />
                    
                    <button 
                        onClick={retakePhoto}
                        className="absolute top-2 left-2 bg-black/60 text-white p-1.5 rounded-full backdrop-blur-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    </button>
                </div>
                
                <div className="space-y-1">
                    <div className="flex justify-between items-end">
                         <label className="text-xs font-medium text-slate-300">Legenda</label>
                         {analyzing && (
                             <span className="text-[10px] text-brand-accent animate-pulse flex items-center gap-1">
                                 ✨ IA Sugerindo...
                             </span>
                         )}
                    </div>
                    <textarea 
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Escreva algo ou aguarde a IA..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-brand-primary outline-none resize-none h-16 transition-all placeholder:text-slate-600"
                        maxLength={140}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">O que você treinou hoje?</label>
                    <div className="flex flex-wrap gap-2">
                        {MUSCLE_GROUPS.map((tag) => {
                            const isSelected = selectedTags.includes(tag);
                            return (
                                <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                                        isSelected 
                                            ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-pink-900/30 transform scale-105' 
                                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
                                    }`}
                                >
                                    {tag}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-800/50 shrink-0">
          <Button 
            onClick={handleSubmit} 
            fullWidth 
            variant="accent" 
            disabled={!preview || isSubmitting}
            className="py-3 text-base shadow-xl flex justify-center items-center gap-2"
          >
            {isSubmitting ? 'Enviando...' : 'Confirmar Check-in HD'}
          </Button>
        </div>
      </div>
    </div>
  );
};