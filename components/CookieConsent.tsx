import React, { useState, useEffect } from 'react';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verifica se já aceitou
    const consent = localStorage.getItem('gymrank_cookie_consent');
    if (!consent) {
      // Pequeno delay para animação de entrada
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('gymrank_cookie_consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6 bg-slate-900/95 border-t border-slate-700 backdrop-blur-xl shadow-2xl animate-fade-in flex flex-col md:flex-row items-center justify-center gap-4">
      <div className="flex items-center gap-3 max-w-2xl">
        <div className="text-3xl">🍪</div>
        <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
          Utilizamos cookies e armazenamento local para manter você conectado, salvar seu histórico de treinos e garantir que a Cabra saiba quem é o líder do ranking. Ao continuar, você concorda com isso.
        </p>
      </div>
      <button 
        onClick={handleAccept}
        className="bg-brand-primary hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-blue-900/20 whitespace-nowrap w-full md:w-auto text-sm"
      >
        Entendi e Aceito
      </button>
    </div>
  );
};