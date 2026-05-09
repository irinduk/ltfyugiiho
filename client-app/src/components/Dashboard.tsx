import React from 'react';
import { Calendar as CalendarIcon, History, ArrowLeftRight, User, CheckCircle2, XCircle } from 'lucide-react';
import { Employee, Shift, Role, Vacation } from '../types';
import { StatCard } from './StatCard';

interface DashboardProps {
    role: Role;
    user: Employee;
    shifts: Shift[];
    employees: Employee[];
    onApprove: (id: string, targetId: string) => void;
    onReject: (id: string) => void;
    vacations: Vacation[];
    onVacationStatusChange: (id: number, status: 'Approved' | 'Rejected') => void;
    theme: 'dark' | 'light';
}

export function Dashboard({
    role,
    user,
    shifts,
    employees,
    onApprove,
    onReject,
    vacations,
    onVacationStatusChange,
    theme
}: DashboardProps) {
    const pendingSwaps = shifts.filter(s => s.status === 'PendingSwap');
    const vacationRequests = vacations
        .filter(v => v.status === 'Pending')
        .slice()
        .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

    // --- ИСПРАВЛЕНИЕ ДЛЯ ДАШБОРДА ---
    // Получаем текущий месяц и год
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Считаем только смены, которые выпадают на текущий месяц
    const myShiftsCount = shifts.filter(s => {
        if (String(s.employeeId).toLowerCase() !== String(user.id).toLowerCase()) return false;
        if (!s.date) return false;
        const shiftDate = new Date(s.date);
        return shiftDate.getMonth() === currentMonth && shiftDate.getFullYear() === currentYear;
    }).length;
    // ---------------------------------

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                        Добро пожаловать, {user.name.split(' ')[0]}
                    </h2>
                    <p className={`mt-1 font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>
                        Сегодня {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}. Ваша роль: {role}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Смен в этом месяце" value={myShiftsCount.toString()} icon={CalendarIcon} color="indigo" theme={theme} />
                <StatCard title="Часов отдыха" value={`${user.lastRestHours || 0}ч`} icon={History} color={(user.lastRestHours || 0) < 12 ? 'red' : 'green'} theme={theme} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className={`p-6 rounded-2xl border transition-all group ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Запросы на замену</p>
                            <h4 className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{pendingSwaps.length} ожидает</h4>
                        </div>
                        <div className="p-3 rounded-xl text-indigo-500 bg-indigo-500/10 border border-indigo-500/20">
                            <ArrowLeftRight size={24} />
                        </div>
                    </div>
                    <div className="space-y-4">
                        {pendingSwaps.length === 0 ? (
                            <p className={`text-sm italic ${theme === 'dark' ? 'text-slate-400' : 'text-blue-600/60'}`}>Нет активных запросов</p>
                        ) : (
                            pendingSwaps.map(s => {
                                const requester = employees.find(e => String(e.id).toLowerCase() === String(s.employeeId).toLowerCase());
                                const eligible = employees.filter(e =>
                                    String(e.id).toLowerCase() !== String(s.employeeId).toLowerCase() &&
                                    e.role === 'Engineer' &&
                                    e.clearances?.some(c => requester?.clearances?.includes(c))
                                );

                                return (
                                    <div key={s.id} className={`p-4 rounded-xl border space-y-4 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-800'}`}>
                                                    <User size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Запрос от: {requester?.name}</p>
                                                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900 font-bold'}`}>Смена: {s.date} ({s.type === 'Custom' ? `${s.startTime}-${s.endTime}` : (s.type === 'Day' ? 'День' : 'Ночь')})</p>
                                                </div>
                                            </div>
                                            {(role !== 'Manager' && role !== 'Admin') && (
                                                <span className="text-xs px-2 py-1 bg-white text-slate-900 dark:text-blue-400 rounded-md border border-slate-200">Ожидает</span>
                                            )}
                                        </div>

                                        {(role === 'Manager' || role === 'Admin') && (
                                            <div className="flex items-center space-x-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                                                <select
                                                    id={`replace-select-${s.id}`}
                                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                                                >
                                                    <option value="">Выберите замену...</option>
                                                    {eligible.map(e => (
                                                        <option key={e.id} value={e.id}>{e.name}</option>
                                                    ))}
                                                </select>
                                                <div className="flex space-x-1">
                                                    <button
                                                        onClick={() => {
                                                            const targetId = (document.getElementById(`replace-select-${s.id}`) as HTMLSelectElement).value;
                                                            if (targetId) onApprove(s.id, targetId);
                                                        }}
                                                        className="p-2 text-green-600 dark:text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                                                        title="Утвердить замену"
                                                    >
                                                        <CheckCircle2 size={20} />
                                                    </button>
                                                    <button
                                                        onClick={() => onReject(s.id)}
                                                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                        title="Отклонить"
                                                    >
                                                        <XCircle size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className={`p-6 rounded-2xl border transition-all group ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div>
                        <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Информация</p>
                        <h4 className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Личный статус</h4>
                        <p className={`mt-3 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                            Список допусков и управление ими перенесены в раздел персонала.
                        </p>
                    </div>
                </div>
            </div>

            {(role === 'Manager' || role === 'Admin') && (
                <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800 shadow-xl' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Заявки на отпуска</p>
                            <h4 className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{vacationRequests.length} всего</h4>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-72 overflow-auto">
                        {vacationRequests.length === 0 ? (
                            <p className={`text-sm italic ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Заявок пока нет</p>
                        ) : vacationRequests.map(v => {
                            const emp = employees.find(e => String(e.id).toLowerCase() === String(v.employeeId).toLowerCase());
                            const statusColor = v.status === 'Approved'
                                ? 'text-green-500'
                                : v.status === 'Rejected'
                                    ? 'text-red-500'
                                    : 'text-amber-500';
                            return (
                                <div key={v.id} className={`p-3 rounded-xl border ${theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold">{emp?.name || '—'}</p>
                                            <p className="text-xs">{v.leaveType}: {v.startDate}..{v.endDate}</p>
                                        </div>
                                        <span className={`text-xs font-bold ${statusColor}`}>{v.status}</span>
                                    </div>
                                    {v.status === 'Pending' && (
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={() => onVacationStatusChange(v.id, 'Approved')} className="px-2 py-1 rounded bg-emerald-600 text-white text-xs">Одобрить</button>
                                            <button onClick={() => onVacationStatusChange(v.id, 'Rejected')} className="px-2 py-1 rounded bg-red-600 text-white text-xs">Отклонить</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}