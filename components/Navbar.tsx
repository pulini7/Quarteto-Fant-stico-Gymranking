import React from 'react';
import { Tab } from '../types';

interface NavbarProps {
  activeTab: Tab;
  onSwitch: (tab: Tab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSwitch }) => {
  const navItems = [
    { id: Tab.DASHBOARD, label: 'Início', icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    )},
    { id: Tab.FEED, label: 'Feed', icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
    )},
    { id: Tab.LEADERBOARD, label: 'Ranking', icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
    )},
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-safe z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
      <div className="flex justify-around items-center p-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSwitch(item.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl w-full transition-all active:scale-95 touch-manipulation ${
                isActive ? 'text-brand-accent' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className={`p-1.5 rounded-2xl transition-all ${isActive ? 'bg-slate-800 shadow-inner' : ''}`}>
                  {item.icon}
              </div>
              <span className={`text-[10px] mt-1 font-bold ${isActive ? 'text-brand-accent' : 'text-slate-600'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};