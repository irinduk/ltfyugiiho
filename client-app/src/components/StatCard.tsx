import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: 'blue' | 'indigo' | 'red' | 'green';
  theme: 'dark' | 'light';
}

export function StatCard({ title, value, icon: Icon, color, theme }: StatCardProps) {
  const colors: Record<string, string> = {
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    red: 'text-red-500 bg-red-500/10 border-red-500/20',
    green: 'text-green-500 bg-green-500/10 border-green-500/20',
  };

  return (
    <div className={`p-6 rounded-2xl border transition-all group shadow-sm ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800 shadow-xl' : 'bg-white border-slate-200'}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>{title}</p>
          <h4 className={`text-3xl font-bold mt-2 transition-colors ${theme === 'dark' ? 'text-white group-hover:text-blue-400' : 'text-slate-900 group-hover:text-blue-600'}`}>{value}</h4>
        </div>
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
