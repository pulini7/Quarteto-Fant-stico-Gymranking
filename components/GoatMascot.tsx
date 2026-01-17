import React from 'react';
import { Button } from './Button';

export type GoatMood = 'SLEEPING' | 'DISAPPOINTED' | 'CELEBRATING' | 'CHECKIN_DONE' | null;

interface GoatMascotProps {
  mood: GoatMood;
  onDismiss: () => void;
}

export const GoatMascot: React.FC<GoatMascotProps> = ({ mood, onDismiss }) => {
  if (!mood) return null;

  const content = {
    SLEEPING: {
      emoji: '💤 🐐',
      title: 'A Cabra está Dormindo...',
      message: 'Faz 3 dias que você não aparece! A cabra entrou em hibernação de tristeza. Vá treinar para acordá-la!',
      color: 'from-indigo-600 to-blue-900',
      button: 'Vou treinar agora!',
      sound: 'zZzZz...'
    },
    DISAPPOINTED: {
      emoji: '🐐 💔',
      title: 'Quebra de Streak',
      message: 'A cabra está profundamente decepcionada. Você quebrou sua sequência de treinos! Não deixe isso acontecer de novo.',
      color: 'from-red-600 to-orange-900',
      button: 'Prometo focar!',
      sound: 'Méééé... (triste)'
    },
    CELEBRATING: {
      emoji: '🐐 🏆 👑',
      title: 'A NOVA LÍDER!',
      message: 'MÉÉÉÉ! A cabra está pulando de alegria! Você assumiu o 1º lugar no Ranking! O rebanho tem uma nova rainha.',
      color: 'from-yellow-500 to-amber-700',
      button: 'Eu sou a lenda!',
      sound: 'MÉÉÉÉÉ!!! (feliz)'
    },
    CHECKIN_DONE: {
      emoji: '🐐 💪 🔥',
      title: 'TREINO PAGO!',
      message: 'Boa! A cabra viu seu esforço. Mais um dia vencido, mais perto do objetivo. Continue firme!',
      color: 'from-emerald-500 to-green-800',
      button: 'Vamos pra cima!',
      sound: 'MÉÉÉ! (Orgulhosa)'
    }
  };

  const current = content[mood];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
      <div className={`w-full max-w-sm rounded-3xl border-2 border-white/20 shadow-2xl overflow-hidden relative bg-gradient-to-br ${current.color}`}>
        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 p-8 text-center flex flex-col items-center">
          
          <div className="text-6xl md:text-8xl mb-6 animate-bounce drop-shadow-2xl grayscale-0">
            {current.emoji}
          </div>

          <h3 className="text-3xl font-black text-white uppercase tracking-tighter mb-2 leading-none drop-shadow-md">
            {current.title}
          </h3>
          
          <div className="bg-black/30 rounded-xl p-4 mb-6 backdrop-blur-sm border border-white/10">
             <p className="text-white font-medium text-lg leading-relaxed">
               "{current.message}"
             </p>
             <p className="text-xs text-white/50 mt-2 font-mono uppercase tracking-widest">{current.sound}</p>
          </div>

          <Button 
            onClick={onDismiss} 
            fullWidth 
            className="bg-white text-black hover:bg-slate-200 border-0 font-black tracking-widest py-4 shadow-xl"
          >
            {current.button}
          </Button>
        </div>
      </div>
    </div>
  );
};