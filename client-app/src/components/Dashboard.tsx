import React, { useState } from 'react';
import { ShieldCheck, Calendar as CalendarIcon, History, ArrowLeftRight, User, CheckCircle2, XCircle } from 'lucide-react';
import { Employee, Shift, Role } from '../types';
import { StatCard } from './StatCard';

interface DashboardProps {
    role: Role;
    user: Employee;
    shifts: Shift[];
    employees: Employee[];
    allClearances: string[];
    onApprove: (id: string, targetId: string) => void;
    onReject: (id: string) => void;
    onAddClearance: (empId: string, clearance: string) => void;
    theme: 'dark' | 'light';
}

export function Dashboard({
    role,
    user,
    shifts,
    employees,
    allClearances,
    onApprove,
    onReject,
    onAddClearance,
    theme
}: DashboardProps) {
    const pendingSwaps = shifts.filter(s => s.status === 'PendingSwap');
    const [showClearanceSelect, setShowClearanceSelect] = useState(false);

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
                <StatCard title="Активные допуски" value={(user.clearances?.length || 0).toString()} icon={ShieldCheck} color="blue" theme={theme} />

                {/* ИСПРАВЛЕНО: Теперь передаем myShiftsCount.toString() */}
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
                                const requester = employees.find(e => e.id === s.employeeId);
                                const eligible = employees.filter(e =>
                                    e.id !== s.employeeId &&
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
                                            {role !== 'Manager' && (
                                                <span className="text-xs px-2 py-1 bg-white text-slate-900 dark:text-blue-400 rounded-md border border-slate-200">Ожидает</span>
                                            )}
                                        </div>

                                        {role === 'Manager' && (
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
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <p className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Ваши допуски</p>
                            <h4 className={`text-2xl font-bold mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{user.clearances?.length || 0} активно</h4>
                        </div>
                        <div className="p-3 rounded-xl text-green-500 bg-green-500/10 border border-green-500/20">
                            <ShieldCheck size={24} />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(user.clearances || []).map(c => (
                            <span key={c} className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-800 border-slate-200 shadow-sm'}`}>
                                {c}
                            </span>
                        ))}
                        {role === 'Manager' && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowClearanceSelect(!showClearanceSelect)}
                                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all font-bold ${theme === 'dark' ? 'bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'}`}
                                >
                                    + Добавить допуск
                                </button>
                                {showClearanceSelect && (
                                    <div className={`absolute top-full left-0 mt-2 w-48 border rounded-xl shadow-2xl z-10 p-2 overflow-y-auto max-h-48 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                        {allClearances.filter(c => !(user.clearances || []).includes(c)).map(c => (
                                            <button
                                                key={c}
                                                onClick={() => {
                                                    onAddClearance(user.id, c);
                                                    setShowClearanceSelect(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'}`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                        {allClearances.filter(c => !(user.clearances || []).includes(c)).length === 0 && (
                                            <p className={`text-[10px] p-2 italic ${theme === 'dark' ? 'text-slate-500' : 'text-blue-600/60'}`}>Все допуски получены</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}