import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';

interface CheckInModalProps {
  onConfirm: (photoBase64: string, caption: string) => void;
  onClose: () => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({ onConfirm, onClose }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Iniciar câmera ao montar ou mudar o modo (frontal/traseira)
  useEffect(() => {
    if (!preview) {
      startCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, preview]);

  const startCamera = async () => {
    stopCamera(); // Garante que a anterior pare antes de iniciar outra
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Erro na câmera:", err);
      setCameraError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Define o tamanho do canvas igual ao do vídeo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        // Espelhar horizontalmente se for câmera frontal para parecer um espelho
        if (facingMode === 'user') {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPreview(dataUrl);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setPreview(null);
    // O useEffect cuidará de reiniciar a câmera pois preview mudou para null
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleSubmit = () => {
    if (preview) {
        onConfirm(preview, caption);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className="bg-brand-card w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Prova de Treino 📸</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center justify-start space-y-6">
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
                            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} // Espelha visualmente o vídeo frontal
                        />
                    )}
                    
                    {/* Controles sobrepostos ao vídeo */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center space-x-6">
                        <button 
                            onClick={toggleCamera} 
                            className="p-3 bg-slate-800/50 backdrop-blur text-white rounded-full hover:bg-slate-700/80 transition-all active:scale-95"
                            title="Trocar Câmera"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0-4.418-3.582-8-8-8S4 5.582 4 10"/><path d="M4 14c0 4.418 3.582 8 8 8s8-3.582 8-8"/><path d="M10 2 8 4h4Z"/><path d="m14 22 2-2h-4Z"/></svg>
                        </button>

                        <button 
                            onClick={takePhoto} 
                            className="w-16 h-16 rounded-full border-4 border-white bg-transparent flex items-center justify-center hover:bg-white/20 transition-all active:scale-90"
                        >
                            <div className="w-12 h-12 bg-brand-primary rounded-full"></div>
                        </button>

                         <div className="w-12"></div> {/* Spacer para balancear o layout */}
                    </div>
                </div>
                <p className="text-xs text-slate-500 text-center">Tire uma foto sua ou dos equipamentos agora.</p>
                <canvas ref={canvasRef} hidden />
            </div>
          ) : (
            <div className="w-full space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-slate-600 shadow-lg bg-black">
                    <img src={preview} alt="Proof" className="w-full h-auto max-h-[40vh] object-contain mx-auto" />
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Legenda (Opcional)</label>
                    <textarea 
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        placeholder="Como foi o treino? Solta o verbo..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-brand-primary outline-none resize-none h-20"
                        maxLength={140}
                    />
                </div>

                <button 
                    onClick={retakePhoto}
                    className="text-sm text-slate-400 hover:text-white underline w-full text-center py-2"
                >
                    Tirar outra foto
                </button>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/50">
          <Button 
            onClick={handleSubmit} 
            fullWidth 
            variant="accent" 
            disabled={!preview}
            className="py-4 text-lg"
          >
            Confirmar Check-in
          </Button>
        </div>
      </div>
    </div>
  );
};