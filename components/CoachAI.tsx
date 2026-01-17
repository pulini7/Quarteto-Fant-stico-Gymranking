import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { createCoachSession } from '../services/geminiService';
import { Chat } from "@google/genai";

interface CoachAIProps {
  user: User;
  onClose?: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

// Componente auxiliar para renderizar texto formatado (Markdown melhorado)
const FormattedText: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  // Helper para processar negrito (**texto**)
  const parseContent = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
            <strong key={index} className={isUser ? "font-bold text-white" : "font-extrabold text-brand-accent"}>
                {part.slice(2, -2)}
            </strong>
        );
      }
      return part;
    });
  };

  const lines = text.split('\n');
  
  return (
    <div className={`space-y-2 ${isUser ? 'text-right' : 'text-left text-slate-200'}`}>
      {lines.map((line, i) => {
          const trimmed = line.trim();
          
          // Ignorar linhas vazias consecutivas, mas manter um espaçador
          if (!trimmed) return <div key={i} className="h-1" />;

          // Cabeçalhos (### Título)
          if (trimmed.startsWith('#')) {
              const level = trimmed.match(/^#+/)?.[0].length || 0;
              const cleanText = trimmed.replace(/^#+\s*/, '');
              return (
                  <h3 key={i} className={`font-black uppercase tracking-wide mt-3 mb-1 text-brand-primary ${level > 2 ? 'text-sm' : 'text-base'}`}>
                      {parseContent(cleanText)}
                  </h3>
              );
          }

          // Listas com Marcadores (- Item ou * Item)
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
             return (
                 <div key={i} className="flex gap-2 pl-1 items-start group">
                     <span className="text-brand-accent mt-1.5 text-[10px] opacity-80 group-hover:opacity-100 transition-opacity">➤</span>
                     <span className="flex-1 leading-relaxed text-sm">
                         {parseContent(trimmed.replace(/^[-*]\s/, ''))}
                     </span>
                 </div>
             )
          }

          // Listas Numeradas (1. Item)
          if (/^\d+\.\s/.test(trimmed)) {
             const number = trimmed.match(/^\d+\./)?.[0];
             const content = trimmed.replace(/^\d+\.\s/, '');
             return (
                 <div key={i} className="flex gap-2 pl-1 items-start">
                     <span className="text-brand-primary font-bold text-xs mt-0.5 min-w-[1.2rem] text-right">
                         {number}
                     </span>
                     <span className="flex-1 leading-relaxed text-sm">
                         {parseContent(content)}
                     </span>
                 </div>
             )
          }
          
          // Parágrafo Normal
          return (
              <p key={i} className="leading-relaxed text-sm min-h-[1.2em]">
                  {parseContent(line)}
              </p>
          );
      })}
    </div>
  );
};

export const CoachAI: React.FC<CoachAIProps> = ({ user, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Inicializa o chat ao montar o componente
  useEffect(() => {
    const initChat = async () => {
      try {
        const chat = createCoachSession(user);
        chatSessionRef.current = chat;
        
        setIsLoading(true);
        setTimeout(async () => {
            try {
                // Mensagem inicial do sistema pedindo proatividade
                const response = await chat.sendMessage({ message: "Se apresente para o aluno de forma breve, com energia, usando formatação (negrito para destaque). Pergunte qual o treino de hoje." });
                if (response.text) {
                    setMessages([{
                        id: 'init',
                        role: 'model',
                        text: response.text
                    }]);
                }
            } catch (e) {
                setMessages([{
                    id: 'init',
                    role: 'model',
                    text: `Fala **${user.name}**! Coach Quarteto na área. 🦍\n\nQual a dúvida sobre o treino de hoje? 💪`
                }]);
            } finally {
                setIsLoading(false);
            }
        }, 500);

      } catch (error) {
        console.error("Erro ao iniciar chat:", error);
      }
    };

    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !chatSessionRef.current || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMsg.text });
      const responseText = result.text;

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText || "Desculpe, não entendi. Pode repetir? 🤔"
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Erro no chat:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Ocorreu um erro na comunicação com a base. Tente novamente. ⚠️"
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-brand-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-800/80 border-b border-slate-700 backdrop-blur-md">
        <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center shadow-lg border-2 border-brand-primary overflow-hidden p-0.5">
                <img src="https://robohash.org/GYM-COACH-MUSCLE.png?set=set1&bgset=any" alt="Coach Robot" className="w-full h-full object-cover" />
            </div>
            <div>
            <h2 className="text-base font-bold text-white leading-tight">Coach Quarteto</h2>
            <p className="text-[10px] text-brand-accent font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse"></span>
                Online
            </p>
            </div>
        </div>
        {onClose && (
            <button 
                onClick={onClose} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
            >
                ✕
            </button>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-5 p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
             {/* Avatar do Bot na mensagem */}
             {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-600 mr-2 mt-1 shrink-0 bg-slate-800 shadow-sm">
                     <img src="https://robohash.org/GYM-COACH-MUSCLE.png?set=set1" alt="Bot" className="w-full h-full object-cover" />
                </div>
             )}
             
            <div
              className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-md transition-all ${
                msg.role === 'user'
                  ? 'bg-brand-primary text-white rounded-br-none'
                  : 'bg-slate-800/95 border border-slate-700 rounded-bl-none shadow-slate-900/50'
              }`}
            >
              <FormattedText text={msg.text} isUser={msg.role === 'user'} />
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
             <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-600 mr-2 mt-1 shrink-0 bg-slate-800">
                <img src="https://robohash.org/GYM-COACH-MUSCLE.png?set=set1" alt="Bot" className="w-full h-full object-cover" />
             </div>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none p-4 flex items-center gap-1.5 w-16 h-10 shadow-sm">
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-800/50 border-t border-slate-700">
        <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
            <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte sobre treino..."
            className="flex-1 bg-slate-900 border border-slate-600 rounded-full px-5 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
            disabled={isLoading}
            />
            <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="w-11 h-11 bg-brand-primary rounded-full flex items-center justify-center text-white shadow-lg hover:bg-pink-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
        </form>
      </div>
    </div>
  );
};