import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  theme: 'dark' | 'light';
}

export const SidebarItem = ({ icon: Icon, label, active, onClick, theme }: SidebarItemProps) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
      active 
        ? 'bg-blue-600 text-white shadow-md' 
        : `${theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-black hover:text-blue-900 hover:bg-slate-100'} font-bold`
    }`}
  >
    <Icon size={20} className={active ? 'text-white' : (theme === 'dark' ? 'text-slate-500' : 'text-black')} />
    <span className="font-bold">{label}</span>
  </button>
);
