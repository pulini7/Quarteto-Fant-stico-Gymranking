import React, { useState } from 'react';
import { Button } from './Button';
import { generateAvatarImage } from '../services/geminiService';

interface AvatarModalProps {
  currentAvatar: string;
  onSave: (base64Image: string) => void;
  onClose: () => void;
}

export const AvatarModal: React.FC<AvatarModalProps> = ({ currentAvatar, onSave, onClose }) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'ai'>('upload');
  const [preview, setPreview] = useState<string>(currentAvatar);
  const [aiPrompt, setAiPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiGeneration = async () => {
    if (!aiPrompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateAvatarImage(aiPrompt);
      if (result) {
        setPreview(result);
      } else {
        setError("Não foi possível gerar a imagem. Tente outro prompt.");
      }
    } catch (err) {
      setError("Erro ao conectar com a IA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-brand-card w-full max-w-md rounded-3xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Editar Avatar</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Preview Area */}
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full p-1 border-4 border-brand-primary relative">
              <img 
                src={preview} 
                alt="Preview" 
                className="w-full h-full rounded-full object-cover bg-slate-800"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 bg-slate-800 p-1 rounded-xl">
            <button 
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'upload' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setActiveTab('upload')}
            >
              Upload Foto
            </button>
            <button 
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'ai' ? 'bg-brand-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
              onClick={() => setActiveTab('ai')}
            >
              Gerar com IA
            </button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[120px]">
            {activeTab === 'upload' ? (
              <div className="space-y-3 text-center border-2 border-dashed border-slate-700 rounded-xl p-6 hover:border-slate-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <label className="block text-sm text-slate-300 cursor-pointer">
                  <span className="text-brand-accent hover:underline">Clique para enviar</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
                <p className="text-xs text-slate-500">PNG, JPG até 5MB</p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-sm text-slate-300">Descreva seu avatar épico:</label>
                <textarea 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ex: Um leão ciborgue treinando com halteres de neon..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-brand-primary outline-none resize-none h-24"
                />
                {error && <p className="text-xs text-brand-danger">{error}</p>}
                <Button 
                  onClick={handleAiGeneration} 
                  disabled={loading || !aiPrompt} 
                  fullWidth 
                  variant="secondary"
                  className="py-2 text-sm"
                >
                  {loading ? 'Gerando...' : '✨ Gerar Imagem'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-700 bg-slate-800/50 flex gap-3">
          <Button onClick={onClose} variant="secondary" className="flex-1">Cancelar</Button>
          <Button onClick={() => onSave(preview)} className="flex-1">Salvar Avatar</Button>
        </div>
      </div>
    </div>
  );
};