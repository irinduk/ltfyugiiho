import React from 'react';
import { ShieldCheck, Database, History, CheckCircle2 } from 'lucide-react';

interface SecurityPanelProps {
  theme: 'dark' | 'light';
}

export function SecurityPanel({ theme }: SecurityPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>Панель ИБ и Безопасности</h2>
        <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-widest">
          Compliance: 152-ФЗ / GDPR Ready
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-red-900/20 shadow-sm dark:shadow-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center text-slate-900 dark:text-white">
            <ShieldCheck className="mr-2 text-red-600 dark:text-red-500" size={20} />
            Политики доступа (RBAC)
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-300">Шифрование трафика</span>
              <span className="text-xs font-mono text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded">TLS 1.3 Active</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-300">Защита ПДн (152-ФЗ)</span>
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded">AES-256 Encrypted</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-300">Минимальная длина пароля</span>
              <span className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-900 dark:text-white">12 символов</span>
            </div>
            <button className="w-full py-2 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-sm hover:bg-red-500/10 transition-all">Обновить политики безопасности</button>
          </div>
        </div>
        
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl">
          <h3 className={`text-lg font-semibold mb-4 flex items-center ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
            <Database className="mr-2 text-blue-600 dark:text-blue-500" size={20} />
            Postgres Pro Cluster
          </h3>
          <div className="space-y-4">
            <div className={`flex items-center justify-between p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-800'}`}>Статус БД</span>
              <span className="text-xs text-green-600 dark:text-green-400 font-bold">CONNECTED</span>
            </div>
            <div className={`flex items-center justify-between p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-800'}`}>Версия</span>
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-black'}`}>Postgres Pro Enterprise 15.4</span>
            </div>
            <div className={`flex items-center space-x-3 p-3 border rounded-xl ${theme === 'dark' ? 'bg-green-500/5 border-green-500/20' : 'bg-white border-green-200 shadow-sm'}`}>
              <CheckCircle2 className="text-green-600 dark:text-green-500" size={18} />
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-black'}`}>Бэкап: Сегодня 04:00 (Успешно)</span>
            </div>
            <button className={`w-full py-2 border rounded-lg text-sm transition-all font-bold ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm'}`}>Управление кластером</button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl">
        <h3 className={`text-lg font-semibold mb-4 flex items-center ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
          <History className="mr-2 text-indigo-600 dark:text-indigo-500" size={20} />
          Контроль сессий и RBAC
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl border text-center ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
            <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>12</p>
            <p className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-800'}`}>Активных сессий</p>
          </div>
          <div className={`p-4 rounded-xl border text-center ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
            <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>0</p>
            <p className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-800'}`}>Попыток взлома</p>
          </div>
          <div className={`p-4 rounded-xl border text-center ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
            <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>100%</p>
            <p className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-800'}`}>Целостность логов</p>
          </div>
        </div>
      </div>
    </div>
  );
}
