import React, { useState } from 'react';
import { FileText, Search, ShieldAlert, Filter } from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogViewProps {
    logs: AuditLog[];
    theme: 'dark' | 'light';
}

export function AuditLogView({ logs, theme }: AuditLogViewProps) {
    const [searchTerm, setSearchTerm] = useState('');

    // Фильтрация логов по поиску
    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.ipAddress && log.ipAddress.includes(searchTerm))
    );

    // Форматирование даты в привычный вид
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(date);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className={`text-2xl font-bold flex items-center space-x-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        Журнал аудита (Audit Log)
                    </h2>
                    <p className={`text-sm mt-1 font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        Система регистрации событий ИБ
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} size={18} />
                        <input
                            type="text"
                            placeholder="Поиск по событиям..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`pl-10 pr-4 py-2 rounded-xl border outline-none text-sm w-64 transition-all focus:border-blue-500 ${theme === 'dark' ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                        />
                    </div>
                    <button className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-colors font-bold shadow-sm border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        <FileText size={18} />
                        <span>Экспорт</span>
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <tr>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Время</th>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Пользователь</th>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Действие</th>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider text-right ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>IP-адрес</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <ShieldAlert className={`mx-auto mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} size={48} />
                                        <p className={`font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>События не найдены</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td className={`px-6 py-4 text-sm font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${theme === 'dark' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                                                {log.userName || 'Система'}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-900'}`}>
                                            {log.action}
                                        </td>
                                        <td className={`px-6 py-4 text-sm font-mono text-right ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                                            {log.ipAddress || '127.0.0.1'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}