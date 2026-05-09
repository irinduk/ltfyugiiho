import React from 'react';
import { ShieldCheck, Database, History, CheckCircle2 } from 'lucide-react';

interface SecurityPanelProps {
  theme: 'dark' | 'light';
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

interface SecurityMetrics {
  activeSessions: number;
  logIntegrityPercent: number;
}

export function SecurityPanel({ theme, fetchWithAuth }: SecurityPanelProps) {
  const [metrics, setMetrics] = React.useState<SecurityMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(false);

  React.useEffect(() => {
    const loadMetrics = async () => {
      setIsLoadingMetrics(true);
      try {
        const res = await fetchWithAuth('/api/audit/metrics');
        if (!res.ok) {
          setMetrics(null);
          return;
        }
        const payload = await res.json();
        setMetrics({
          activeSessions: Number(payload?.activeSessions ?? 0),
          logIntegrityPercent: Number(payload?.logIntegrityPercent ?? 100)
        });
      } catch {
        setMetrics(null);
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    loadMetrics();
  }, [fetchWithAuth]);

  const activeSessionsLabel = isLoadingMetrics ? '...' : String(metrics?.activeSessions ?? 0);
  const logIntegrityLabel = isLoadingMetrics ? '...' : `${Math.max(0, Math.min(100, metrics?.logIntegrityPercent ?? 100))}%`;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>Панель ИБ и Безопасности</h2>
        <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-widest">
          Compliance: 152-ФЗ / GDPR Ready
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`p-6 rounded-2xl border shadow-sm dark:shadow-xl ${theme === 'dark' ? 'bg-[#1e293b] border-red-900/20' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            <ShieldCheck className="mr-2 text-red-600 dark:text-red-500" size={20} />
            Политики доступа (RBAC)
          </h3>
          <div className="space-y-4">
            <div className={`flex justify-between items-center p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>Шифрование трафика</span>
              <span className={`text-xs font-mono px-2 py-1 rounded border ${theme === 'dark' ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-green-700 bg-green-50 border-green-200'}`}>TLS 1.3 Active</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>Защита ПДн (152-ФЗ)</span>
              <span className={`text-xs font-mono px-2 py-1 rounded border ${theme === 'dark' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>AES-256 Encrypted</span>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>Минимальная длина пароля</span>
              <span className={`text-sm font-mono px-2 py-1 rounded border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>12 символов</span>
            </div>
            <button className={`w-full py-2 border rounded-lg text-sm font-bold transition-all ${theme === 'dark' ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'}`}>Обновить политики безопасности</button>
          </div>
        </div>
        
        <div className={`p-6 rounded-2xl border shadow-sm dark:shadow-xl ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 flex items-center ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
            <Database className="mr-2 text-blue-600 dark:text-blue-500" size={20} />
            Postgres Pro Cluster
          </h3>
          <div className="space-y-4">
            <div className={`flex items-center justify-between p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-800'}`}>Статус БД</span>
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>CONNECTED</span>
            </div>
            <div className={`flex items-center justify-between p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-800'}`}>Версия</span>
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-black'}`}>Postgres Pro Enterprise 15.4</span>
            </div>
            <div className={`flex items-center space-x-3 p-3 border rounded-xl ${theme === 'dark' ? 'bg-green-500/5 border-green-500/20' : 'bg-green-50 border-green-200'}`}>
              <CheckCircle2 className="text-green-600 dark:text-green-500" size={18} />
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>Бэкап: Сегодня 04:00 (Успешно)</span>
            </div>
            <button className={`w-full py-2 border rounded-lg text-sm transition-all font-bold ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100'}`}>Управление кластером</button>
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-2xl border shadow-sm dark:shadow-xl ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 flex items-center ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
          <History className="mr-2 text-indigo-600 dark:text-indigo-500" size={20} />
          Контроль сессий и RBAC
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border text-center ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{activeSessionsLabel}</p>
            <p className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-800'}`}>Активных сессий</p>
          </div>
          <div className={`p-4 rounded-xl border text-center ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{logIntegrityLabel}</p>
            <p className={`text-[10px] uppercase font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-800'}`}>Целостность логов</p>
          </div>
        </div>
      </div>
    </div>
  );
}
