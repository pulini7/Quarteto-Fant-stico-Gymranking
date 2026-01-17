import React from 'react';

export const Confetti: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex justify-center overflow-hidden">
        {/* Simple visual trick for demo purposes, using existing emojis/elements falling */}
        <div className="absolute top-0 animate-bounce text-4xl" style={{left: '20%', animationDuration: '1s'}}>🎉</div>
        <div className="absolute top-10 animate-bounce text-4xl" style={{left: '50%', animationDuration: '1.5s'}}>💪</div>
        <div className="absolute top-5 animate-bounce text-4xl" style={{left: '80%', animationDuration: '1.2s'}}>🔥</div>
        <div className="absolute top-20 animate-bounce text-4xl" style={{left: '35%', animationDuration: '1.8s'}}>✨</div>
        <div className="absolute top-15 animate-bounce text-4xl" style={{left: '65%', animationDuration: '1.3s'}}>🏋️</div>
    </div>
  );
};