import React from 'react';
import { Button } from './Button';
import { loginOrCreateUser } from '../services/storageService';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const users = ['Aline', 'Samila', 'Pâmela', 'Taís'];

  const handleUserSelect = (name: string) => {
    const user = loginOrCreateUser(name);
    onLogin(user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-brand-dark to-slate-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent mb-2 leading-tight">
            QUARTETO FANTÁSTICO<br/>GYMRANKING
          </h1>
          <p className="text-slate-400 mt-4">Quem está entrando na arena hoje?</p>
        </div>

        <div className="bg-brand-card p-8 rounded-2xl border border-slate-700 shadow-2xl">
          <div className="grid grid-cols-1 gap-4">
            {users.map((name) => (
              <Button 
                key={name}
                onClick={() => handleUserSelect(name)}
                variant="secondary"
                className="w-full py-4 text-lg hover:bg-brand-primary hover:text-white hover:border-brand-primary transition-all duration-300 transform hover:scale-[1.02]"
              >
                {name}
              </Button>
            ))}
          </div>
          
          <div className="mt-8 text-center border-t border-slate-700 pt-6">
            <p className="text-xs text-slate-500 uppercase tracking-widest">Apenas membros autorizados</p>
          </div>
        </div>
      </div>
    </div>
  );
};