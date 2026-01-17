import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getCoachMessage } from '../services/geminiService';
import { Button } from './Button';

interface CoachAIProps {
  user: User;
}

export const CoachAI: React.FC<CoachAIProps> = ({ user }) => {
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const fetchMotivation = async () => {
    setLoading(true);
    const msg = await getCoachMessage(user);
    setMessage(msg);
    setLoading(false);
  };

  useEffect(() => {
    // Fetch initial motivation on mount
    fetchMotivation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.checkIns.length]);

  return (
    <div className="space-y-6 animate-fade-in flex flex-col h-[calc(100vh-200px)] justify-center">
      <div className="text-center space-y-2">
        <div className="w-20 h-20 bg-brand-primary rounded-2xl mx-auto flex items-center justify-center text-4xl mb-4 shadow-lg shadow-blue-500/30">
            🤖
        </div>
        <h2 className="text-2xl font-bold text-white">Treinador IA</h2>
        <p className="text-slate-400 text-sm">Powered by Gemini</p>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-600 min-h-[200px] flex items-center justify-center relative">
        {loading ? (
             <div className="flex space-x-2 animate-pulse">
                <div className="w-3 h-3 bg-brand-primary rounded-full"></div>
                <div className="w-3 h-3 bg-brand-primary rounded-full delay-75"></div>
                <div className="w-3 h-3 bg-brand-primary rounded-full delay-150"></div>
             </div>
        ) : (
            <div className="relative z-10">
                <p className="text-xl md:text-2xl font-medium text-slate-200 text-center italic leading-relaxed">
                    "{message}"
                </p>
            </div>
        )}
      </div>

      <div className="pt-4">
        <Button onClick={fetchMotivation} disabled={loading} fullWidth variant="secondary">
            {loading ? 'Pensando...' : 'Pedir Nova Dica'}
        </Button>
      </div>
    </div>
  );
};