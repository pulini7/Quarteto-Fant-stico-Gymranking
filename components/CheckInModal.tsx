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
          // RESOLUÇÃO SEGURA: 1280x720 (HD). 
          // 4K/2K gera strings base64 gigantes que falham no upload em 3G/4G.
          width: { ideal: 1280 }, 
          height: { ideal: 720 }
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
          setCameraError("Não foi possível acessar a câmera. Verifique as permissões.");
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const processImage = (source: CanvasImageSource, sourceWidth: number, sourceHeight: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // --- OTIMIZAÇÃO DE ESTABILIDADE ---
      // Reduz para Max 1024px. Isso gera arquivos de ~150KB (super rápido).
      const MAX_DIMENSION = 1024; 
      let width = sourceWidth;
      let height = sourceHeight;

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
        // Espelhar horizontalmente se for câmera frontal (apenas se for video)
        if (source instanceof HTMLVideoElement && facingMode === 'user') {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }
        
        context.drawImage(source, 0, 0, width, height);
        
        // Qualidade 0.6 é o "sweet spot" entre visual bom no celular e upload instantâneo.
        const dataUrl = canvas.toDataURL('image/jpeg', 0.60);
        
        if (isMountedRef.current) {
            setPreview(dataUrl);
            stopCamera();
            setAnalyzing(true);
        }

        // Analisar imagem (Versão ainda menor para a IA ser rápida)
        const smallCanvas = document.createElement('canvas');
        const scale = 500 / Math.max(width, height);
        smallCanvas.width = width * scale;
        smallCanvas.height = height * scale;
        const smallCtx = smallCanvas.getContext('2d');
        if (smallCtx) {
             smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
             const smallDataUrl = smallCanvas.toDataURL('image/jpeg', 0.5);
             
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
  };

  const takePhoto = async () => {
    playSound.camera(); 
    if (videoRef.current) {
      const video = videoRef.current;
      if (video.readyState !== 4) return;
      processImage(video, video.videoWidth, video.videoHeight);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  processImage(img, img.width, img.height);
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
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
            alert("Erro ao enviar. Tente novamente.");
            setIsSubmitting(false);
        }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in md:p-4">
      <div className="bg-brand-card w-full max-w-md h-full md:h-auto md:max-h-[90vh] md:rounded-3xl border-0 md:border border-slate-700 shadow-2xl overflow-hidden flex flex-col relative">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center shrink-0 bg-brand-card z-10">
          <h3 className="text-lg font-bold text-white">Novo Check-in 📸</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2">✕</button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto flex flex-col items-center justify-start space-y-4 scrollbar-thin scrollbar-thumb-slate-700 w-full">
          {!preview ? (
            <div className="w-full flex flex-col items-center space-y-4 h-full">
                <div className="relative w-full flex-1 min-h-[50vh] bg-black rounded-2xl overflow-hidden shadow-lg border-2 border-slate-700">
                    {cameraError ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 space-y-4">
                            <div className="text-brand-danger font-bold">{cameraError}</div>
                            <p className="text-slate-400 text-sm">Sem problemas! Você pode enviar uma foto da galeria.</p>
                            <label className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-lg border border-slate-500">
                                📂 Escolher Foto
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                            </label>
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
                    
                    {!cameraError && (
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

                            <label className="p-3 bg-slate-800/60 backdrop-blur text-white rounded-full hover:bg-slate-700/80 transition-all active:scale-95 border border-white/10 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-500 text-center">Tire uma foto sua ou dos equipamentos.</p>
                <canvas ref={canvasRef} hidden />
            </div>
          ) : (
            <div className="w-full space-y-3 pb-2">
                <div className="relative rounded-xl overflow-hidden border border-slate-600 shadow-lg bg-black shrink-0">
                    <img src={preview} alt="Proof" className="w-full h-56 object-contain mx-auto bg-black" />
                    
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

        <div className="p-4 border-t border-slate-700 bg-slate-800/90 backdrop-blur shrink-0 z-20 pb-safe">
          <Button 
            onClick={handleSubmit} 
            fullWidth 
            variant="accent" 
            disabled={!preview || isSubmitting}
            className="py-3 text-base shadow-xl flex justify-center items-center gap-2"
          >
            {isSubmitting ? 'Enviando...' : 'Confirmar Check-in'}
          </Button>
        </div>
      </div>
    </div>
  );
};