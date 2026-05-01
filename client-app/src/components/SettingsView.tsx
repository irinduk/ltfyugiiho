import React from 'react';
import { Settings, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { Role } from '../types';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  defaultShiftHours: number;
  setDefaultShiftHours: (h: number) => void;
  role: Role;
}

export function SettingsView({ 
  theme, 
  setTheme, 
  defaultShiftHours, 
  setDefaultShiftHours, 
  role 
}: SettingsViewProps) {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-blue-950'}`}>Настройки системы</h2>
        <p className="text-slate-600 dark:text-slate-400 mt-1 font-medium">Персонализация интерфейса и параметров планирования</p>
      </div>

      <div className={`p-6 rounded-2xl border transition-colors shadow-sm dark:shadow-xl ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-6 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
          <Settings size={20} className="text-blue-500" />
          <span>Внешний вид</span>
        </h3>
        
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Тема оформления</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Переключение между светлым и темным режимом</p>
          </div>
          <div className={`flex p-1 rounded-xl border ${theme === 'dark' ? 'bg-slate-900 border-transparent' : 'bg-slate-100 border-slate-200'}`}>
            <button 
              onClick={() => setTheme('light')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              ☀️ <span>Светлая</span>
            </button>
            <button 
              onClick={() => setTheme('dark')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${theme === 'dark' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-blue-400'}`}
            >
              🌙 <span>Темная</span>
            </button>
          </div>
        </div>
      </div>

      {(role === 'Manager' || role === 'Admin') && (
        <div className={`p-6 rounded-2xl border transition-colors shadow-sm dark:shadow-xl ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-bold mb-6 flex items-center space-x-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
            <CalendarIcon size={20} className="text-blue-500" />
            <span>Параметры планирования</span>
          </h3>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Длительность смены по умолчанию</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Количество часов для дневных и ночных смен</p>
              </div>
              <div className="flex items-center space-x-3">
                <input 
                  type="number" 
                  value={defaultShiftHours}
                  onChange={(e) => setDefaultShiftHours(Number(e.target.value))}
                  className={`w-20 p-2 rounded-lg border text-center font-bold outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  min="1"
                  max="24"
                />
                <span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>часов</span>
              </div>
            </div>
            
            <div className={`p-4 rounded-xl flex items-start space-x-3 border ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/20' : 'bg-white border-slate-200 shadow-sm'}`}>
              <AlertTriangle size={18} className="text-blue-500 mt-0.5 shrink-0" />
              <p className={`text-xs leading-relaxed font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900'}`}>
                Это значение будет использоваться для автоматического расчета нагрузки при назначении новых стандартных смен (День/Ночь). 
                Смены с ручной настройкой времени сохранят свои индивидуальные параметры.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
