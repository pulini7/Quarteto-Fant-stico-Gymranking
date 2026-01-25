import React, { useState, useEffect } from 'react';
import { User, WeeklyPlan as WeeklyPlanType } from '../types';
import { Button } from './Button';
import { saveUser } from '../services/storageService';
import { playSound } from '../services/soundService';

interface WeeklyPlanProps {
    user: User;
    onUpdateUser: (user: User) => void;
    onTriggerCheckIn: () => void;
}

const DAYS_ORDER = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const WeeklyPlan: React.FC<WeeklyPlanProps> = ({ user, onUpdateUser, onTriggerCheckIn }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localPlan, setLocalPlan] = useState<WeeklyPlanType>(user.weeklyPlan || {});
    const [weekDates, setWeekDates] = useState<{ [key: string]: string }>({});

    // Helper para formatar data localmente YYYY-MM-DD (Evita bug de fuso horário UTC)
    const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Calcular as datas da semana atual (Domingo a Sábado)
    useEffect(() => {
        const now = new Date();
        const currentDay = now.getDay(); // 0-6
        const diff = now.getDate() - currentDay; // Ajusta para o Domingo anterior ou hoje

        const dates: { [key: string]: string } = {};
        
        DAYS_ORDER.forEach((day, index) => {
            const d = new Date(now);
            d.setDate(diff + index);
            dates[day] = formatDateLocal(d);
        });
        
        setWeekDates(dates);
    }, []);

    // Atualiza estado local se o usuário mudar
    useEffect(() => {
        setLocalPlan(user.weeklyPlan || {});
    }, [user.weeklyPlan]);

    const handleSave = async () => {
        playSound.success();
        const updatedUser = { ...user, weeklyPlan: localPlan };
        // Atualiza localmente
        onUpdateUser(updatedUser);
        setIsEditing(false);
        // Salva no DB
        await saveUser(updatedUser);
    };

    const handleChange = (day: string, value: string) => {
        setLocalPlan(prev => ({
            ...prev,
            [day]: value
        }));
    };

    const isDayCompleted = (day: string) => {
        const dateStr = weekDates[day];
        if (!dateStr) return false;
        return user.checkIns.some(c => c.date === dateStr);
    };

    const isToday = (day: string) => {
        const dateStr = weekDates[day];
        const todayStr = formatDateLocal(new Date());
        return dateStr === todayStr;
    };

    return (
        <div className="bg-brand-card rounded-3xl p-5 border border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                    📅 Planejamento Semanal
                </h3>
                <button 
                    onClick={() => { playSound.click(); isEditing ? handleSave() : setIsEditing(true); }}
                    className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all ${isEditing ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300 hover:text-white'}`}
                >
                    {isEditing ? 'Salvar' : 'Editar'}
                </button>
            </div>

            <div className="space-y-3">
                {DAYS_ORDER.map((day) => {
                    const completed = isDayCompleted(day);
                    const isCurrentDay = isToday(day);
                    const task = localPlan[day] || '';

                    return (
                        <div key={day} className={`flex items-center gap-3 p-2 rounded-xl border transition-all ${completed ? 'bg-brand-primary/10 border-brand-primary/50' : 'bg-slate-800/50 border-slate-700'} ${isCurrentDay && !completed ? 'ring-1 ring-brand-accent' : ''}`}>
                            <div className="flex flex-col items-center justify-center w-12 shrink-0">
                                <span className={`text-[10px] uppercase font-bold ${isCurrentDay ? 'text-brand-accent' : 'text-slate-500'}`}>{day.substring(0, 3)}</span>
                                <div 
                                    className={`w-6 h-6 rounded-full flex items-center justify-center mt-1 transition-all ${
                                        completed 
                                            ? 'bg-brand-primary text-white shadow-lg scale-110' 
                                            : (isCurrentDay ? 'bg-slate-700 border-2 border-brand-accent cursor-pointer animate-pulse' : 'bg-slate-700 border border-slate-600')
                                    }`}
                                    onClick={() => {
                                        if (isCurrentDay && !completed && !isEditing) {
                                            onTriggerCheckIn();
                                        }
                                    }}
                                >
                                    {completed && (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1">
                                {isEditing ? (
                                    <input 
                                        type="text" 
                                        value={task}
                                        onChange={(e) => handleChange(day, e.target.value)}
                                        placeholder="Ex: Leg Day, Descanso..."
                                        className="w-full bg-slate-900 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 focus:border-brand-primary outline-none"
                                    />
                                ) : (
                                    <div 
                                        className={`text-sm font-medium ${task ? 'text-slate-200' : 'text-slate-600 italic'}`}
                                        onClick={() => { if(isCurrentDay && !completed) onTriggerCheckIn() }}
                                    >
                                        {task || "Sem treino definido"}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {!isEditing && (
                <p className="text-[10px] text-center text-slate-500 mt-4">
                    O "check" é automático quando você posta a foto do treino do dia.
                </p>
            )}
        </div>
    );
};