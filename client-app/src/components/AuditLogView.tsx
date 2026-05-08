import React, { useState } from 'react';
import { FileText, Search, ShieldAlert, Filter, Download } from 'lucide-react';
import { AuditLog, Employee } from '../types';

interface AuditLogViewProps {
    logs: AuditLog[];
    theme: 'dark' | 'light';
    employees: Employee[];
    fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
    onLogsChange: (logs: AuditLog[]) => void;
}

export function AuditLogView({ logs, theme, employees, fetchWithAuth, onLogsChange }: AuditLogViewProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

    // Фильтрация логов по поиску
    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.ipAddress && log.ipAddress.includes(searchTerm))
    );

    const reloadLogs = async (employeeId: string) => {
        try {
            const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
            const res = await fetchWithAuth(`/api/audit${qs}`);
            if (!res.ok) return;
            const data = await res.json();
            onLogsChange(Array.isArray(data) ? data : []);
        } catch (e) {
            // игнорируем, UI покажет старые логи
        }
    };

    // Форматирование даты в привычный вид
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(date);
    };


    // Экспорт аудита в CSV
    const handleExport = () => {
        const headers = ['ID', 'Время', 'Пользователь', 'Действие', 'IP-адрес'];
        const csvRows = [headers.join(';')];

        filteredLogs.forEach(log => {
            const row = [
                log.id,
                formatDate(log.timestamp),
                log.userName || 'Система',
                `"${log.action.replace(/"/g, '""')}"`,
                log.ipAddress || '127.0.0.1'
            ];
            csvRows.push(row.join(';'));
        });

        const csvContent = '\ufeff' + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
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
                        <select
                            value={selectedEmployeeId}
                            onChange={(e) => {
                                const v = e.target.value;
                                setSelectedEmployeeId(v);
                                reloadLogs(v);
                            }}
                            className={`px-3 py-2 rounded-xl border outline-none text-sm transition-all focus:border-blue-500 ${theme === 'dark' ? 'bg-[#1e293b] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                        >
                            <option value="">Все сотрудники</option>
                            {employees
                                .slice()
                                .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                                .map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                        </select>
                    </div>
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
                    <button
                        onClick={handleExport}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-colors font-bold shadow-sm border ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Download size={18} />
                        <span>Экспорт CSV</span>
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <tr>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-black'}`}>Время</th>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-black'}`}>Пользователь</th>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-black'}`}>Действие</th>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider text-right ${theme === 'dark' ? 'text-slate-500' : 'text-black'}`}>IP-адрес</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <ShieldAlert className={`mx-auto mb-3 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-300'}`} size={48} />
                                        <p className={`font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>События не найдены</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'bg-white hover:bg-white'}`}>
                                        <td className={`px-6 py-4 text-sm font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-black'}`}>
                                            {formatDate(log.timestamp)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${theme === 'dark' ? 'bg-slate-800 text-blue-400 border border-slate-700' : 'bg-white text-black border border-slate-200'}`}>
                                                {log.userName || 'Система'}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-sm font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-black'}`}>
                                            {log.action}
                                        </td>
                                        <td className={`px-6 py-4 text-sm font-mono text-right ${theme === 'dark' ? 'text-slate-500' : 'text-black'}`}>
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