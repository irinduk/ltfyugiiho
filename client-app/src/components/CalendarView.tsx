import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, XCircle, Check, X, ArrowLeft, ArrowLeftRight } from 'lucide-react';
// import { motion } from 'motion/react';
import { Employee, Shift, Role, WorkArea } from '../types';
import { WORK_AREAS } from '../constants';

interface CalendarViewProps {
    role: Role;
    user: Employee;
    shifts: Shift[];
    employees: Employee[];
    onAssign: (id: string, date: string, type: 'Day' | 'Night' | 'Custom', workAreaId: string, start?: string, end?: string) => Promise<boolean> | boolean;
    onSwapRequest: (id: string) => void;
    onReassign: (shiftId: string, targetId: string) => void;
    defaultShiftHours: number;
    theme: 'dark' | 'light';
    filterEmployeeId?: string | null;
    onClearFilter?: () => void;
}

export function CalendarView({
    role,
    user,
    shifts,
    employees,
    onAssign,
    onSwapRequest,
    onReassign,
    defaultShiftHours,
    theme,
    filterEmployeeId = null,
    onClearFilter
}: CalendarViewProps) {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isManual, setIsManual] = useState(false);
    const [showOnlyMine, setShowOnlyMine] = useState(false);
    const [reassigningShift, setReassigningShift] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [selectedEmpId, setSelectedEmpId] = useState<string>(employees.filter(e => e.role === 'Engineer')[0]?.id || '');
    const [selectedAreaId, setSelectedAreaId] = useState<string>(WORK_AREAS[0]?.id || '');

    const eligibleEmployees = employees.filter(e => {
        if (e.role !== 'Engineer') return false;
        const area = WORK_AREAS.find(a => a.id === selectedAreaId);
        if (!area) return true;
        return area.requiredClearances.every(c => (e.clearances || []).includes(c) || (e.clearances || []).includes('All'));
    });

    useEffect(() => {
        if (eligibleEmployees.length > 0 && !eligibleEmployees.some(e => e.id === selectedEmpId)) {
            setSelectedEmpId(eligibleEmployees[0].id);
        }
    }, [selectedAreaId, eligibleEmployees, selectedEmpId]);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

    const calculateHours = (shift: Shift) => {
        if (shift.type === 'Day' || shift.type === 'Night') return defaultShiftHours;
        if (shift.type === 'Custom' && shift.startTime && shift.endTime) {
            const start = new Date(`2000-01-01T${shift.startTime}`);
            const end = new Date(`2000-01-01T${shift.endTime}`);
            let diff = (end.getTime() - start.getTime()) / (1000 * 3600);
            if (diff < 0) diff += 24;
            return diff;
        }
        return 0;
    };

    const getDayShifts = (date: string) => {
        let filtered = shifts.filter(s => s.date === date);
        if (filterEmployeeId) {
            filtered = filtered.filter(s => String(s.employeeId).toLowerCase() === String(filterEmployeeId).toLowerCase());
        } else if (showOnlyMine && role === 'Engineer') {
            filtered = filtered.filter(s => String(s.employeeId).toLowerCase() === String(user.id).toLowerCase());
        }
        return filtered;
    };

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>График дежурств: {monthNames[month]} {year}</h2>
                <div className="flex items-center space-x-4">
                    {filterEmployeeId && (
                        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border shadow-sm ${theme === 'dark' ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-xs font-bold uppercase tracking-wider">Фильтр: {employees.find(e => e.id === filterEmployeeId)?.name}</span>
                            <button
                                onClick={onClearFilter}
                                className="hover:text-red-500 transition-colors pl-1"
                                title="Сбросить фильтр"
                            >
                                <X size={14} strokeWidth={3} />
                            </button>
                        </div>
                    )}
                    {role === 'Engineer' && !filterEmployeeId && (
                        <label className={`flex items-center space-x-2 text-sm cursor-pointer transition-colors font-bold ${theme === 'dark' ? 'text-slate-400 hover:text-blue-400' : 'text-slate-900 hover:text-black'}`}>
                            <input
                                type="checkbox"
                                checked={showOnlyMine}
                                onChange={(e) => setShowOnlyMine(e.target.checked)}
                                className={`w-4 h-4 rounded border bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}
                            />
                            <span>Только мои смены</span>
                        </label>
                    )}
                    <div className="flex space-x-2">
                        <button onClick={handlePrevMonth} className={`p-2 rounded-lg border transition-colors shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><ChevronLeft size={20} /></button>
                        <button onClick={handleNextMonth} className={`p-2 rounded-lg border transition-colors shadow-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>

            <div className={`rounded-2xl border overflow-hidden shadow-sm dark:shadow-2xl ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                <div className={`grid grid-cols-7 border-b ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-slate-200 bg-slate-200/50'}`}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                        <div key={d} className={`py-3 text-center text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7">
                    {Array.from({ length: startOffset }).map((_, i) => (
                        <div key={`offset-${i}`} className={`min-h-[120px] p-2 border-r border-b ${theme === 'dark' ? 'border-slate-800 bg-slate-900/20' : 'border-slate-100 bg-slate-200/20'}`}></div>
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const d = i + 1;
                        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                        const dayShifts = getDayShifts(dateStr);
                        const isToday = new Date().toISOString().split('T')[0] === dateStr;

                        return (
                            <div
                                key={d}
                                onClick={() => (role === 'Manager' || role === 'Admin') && setSelectedDate(dateStr)}
                                className={`min-h-[120px] p-2 border-r border-b transition-colors group relative ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/20' : 'border-slate-100 bg-white hover:bg-slate-50'
                                    } ${(role === 'Manager' || role === 'Admin') ? 'cursor-pointer' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-sm font-bold ${isToday ? 'text-blue-600' : (theme === 'dark' ? 'text-slate-500' : 'text-slate-900')}`}>{d}</span>
                                    {(role === 'Manager' || role === 'Admin') && dayShifts.length > 0 && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold inline-flex items-center leading-none ${theme === 'dark' ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                            {dayShifts.reduce((acc, s) => acc + calculateHours(s), 0)}ч
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    {dayShifts.map(s => {
                                        const area = WORK_AREAS.find(a => a.id === s.workAreaId);
                                        const emp = employees.find(e => String(e.id).toLowerCase() === String(s.employeeId).toLowerCase());

                                        return (
                                            <div
                                                key={s.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (role === 'Engineer' && s.status === 'Confirmed') onSwapRequest(s.id);
                                                    if (role === 'Manager' || role === 'Admin') setSelectedDate(dateStr);
                                                }}
                                                className={`text-[10px] p-1.5 rounded-md border truncate transition-all hover:scale-[1.02] font-bold ${s.status === 'PendingSwap' ? 'opacity-50 border-dashed' : ''
                                                    } ${area?.id === 'core' ? 'bg-slate-100 text-slate-700 dark:text-blue-400 border-slate-200' :
                                                        area?.id === 'edge' ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20' :
                                                            area?.id === 'linux' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' :
                                                                area?.id === 'security' ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20' :
                                                                    'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="truncate">
                                                        {s.type === 'Day' ? '☀️' : s.type === 'Night' ? '🌙' : '⏱️'} {(emp?.name || 'Empty').split(' ')[0]}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {selectedDate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className={`border rounded-2xl p-6 w-full max-w-md shadow-2xl my-8 ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-6">
                            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                {isAddingNew ? 'Назначение смены' : 'Детали дня'}: {selectedDate}
                            </h3>
                            <button onClick={() => { setSelectedDate(null); setIsManual(false); setReassigningShift(null); setIsAddingNew(false); }} className="text-slate-500 hover:text-blue-500 transition-colors"><XCircle size={24} /></button>
                        </div>

                        {!isAddingNew ? (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h4 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-black'}`}>Текущие смены</h4>
                                    {getDayShifts(selectedDate).length === 0 ? (
                                        <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                            <p className={`text-sm italic mb-4 ${theme === 'dark' ? 'text-slate-500' : 'text-blue-600/70'}`}>Смен не назначено</p>
                                            <button
                                                onClick={() => setIsAddingNew(true)}
                                                className="px-4 py-2 bg-slate-100 dark:bg-blue-600/20 text-slate-600 dark:text-blue-400 rounded-lg border border-slate-300 dark:border-blue-500/30 text-sm hover:bg-slate-200 dark:hover:bg-blue-600/30 transition-all font-bold"
                                            >
                                                + Назначить первую смену
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {getDayShifts(selectedDate).map(s => {
                                                const emp = employees.find(e => String(e.id).toLowerCase() === String(s.employeeId).toLowerCase());
                                                const isReassigning = reassigningShift === s.id;
                                                const area = WORK_AREAS.find(a => a.id === s.workAreaId);

                                                return (
                                                    <div key={s.id} className={`p-3 bg-white dark:bg-slate-800/50 rounded-xl border transition-all ${isReassigning ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-900 text-white'}`}>
                                                                    {emp?.name.split(' ').map(n => n[0]).join('')}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{emp?.name}</p>
                                                                        <span className={`text-[8px] px-1.5 py-0.5 rounded border uppercase font-bold ${area?.id === 'core' ? 'bg-slate-100 text-slate-700 dark:text-blue-400 border-slate-200' :
                                                                                area?.id === 'edge' ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20' :
                                                                                    area?.id === 'linux' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' :
                                                                                        area?.id === 'security' ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20' :
                                                                                            'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                                                            }`}>
                                                                            {area?.name}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-700 dark:text-slate-400 font-medium">
                                                                        {s.type === 'Custom' ? `${s.startTime} - ${s.endTime}` : (s.type === 'Day' ? '08:00 - 20:00' : '20:00 - 08:00')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <span className={`text-xs font-bold font-mono text-blue-600 dark:text-blue-400`}>{calculateHours(s)}ч</span>
                                                                {(role === 'Manager' || role === 'Admin') && !isReassigning && (
                                                                    <button
                                                                        onClick={() => setReassigningShift(s.id)}
                                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-600/10 rounded transition-colors"
                                                                        title="Переназначить"
                                                                    >
                                                                        <ArrowLeftRight size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {isReassigning && (
                                                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                                                <p className="text-[10px] text-slate-700 dark:text-blue-400 font-bold uppercase mb-2">Выберите нового исполнителя:</p>
                                                                <div className="flex items-center space-x-2">
                                                                    <select
                                                                        id={`reassign-select-${s.id}`}
                                                                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                                                                    >
                                                                        <option value="">Выберите замену...</option>
                                                                        {employees.filter(e => e.id !== s.employeeId && e.role === 'Engineer').map(e => (
                                                                            <option key={e.id} value={e.id}>{e.name}</option>
                                                                        ))}
                                                                    </select>
                                                                    <button
                                                                        onClick={() => {
                                                                            const targetId = (document.getElementById(`reassign-select-${s.id}`) as HTMLSelectElement).value;
                                                                            if (targetId) {
                                                                                onReassign(s.id, targetId);
                                                                                setReassigningShift(null);
                                                                            }
                                                                        }}
                                                                        className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 font-bold"
                                                                    >
                                                                        <Check size={14} />
                                                                    </button>
                                                                    <button onClick={() => setReassigningShift(null)} className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 font-bold">
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2 mb-2">
                                    <button onClick={() => setIsAddingNew(false)} className={`p-1 rounded-full transition-colors ${theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-blue-50'}`}>
                                        <ArrowLeft size={16} className="text-slate-600 dark:text-blue-400" />
                                    </button>
                                    <h4 className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Новое назначение</h4>
                                </div>

                                <div>
                                    <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Рабочая зона (Объект)</label>
                                    <select
                                        id="area-select"
                                        value={selectedAreaId}
                                        onChange={(e) => setSelectedAreaId(e.target.value)}
                                        className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                    >
                                        {WORK_AREAS.map(a => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {WORK_AREAS.find(a => a.id === selectedAreaId)?.requiredClearances.map(c => (
                                            <span key={c} className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded uppercase font-bold">
                                                Нужен: {c}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Сотрудник</label>
                                    <select
                                        id="emp-select"
                                        value={selectedEmpId}
                                        onChange={(e) => setSelectedEmpId(e.target.value)}
                                        className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                                    >
                                        {eligibleEmployees.length > 0 ? (
                                            eligibleEmployees.map(e => (
                                                <option key={e.id} value={e.id}>{e.name}</option>
                                            ))
                                        ) : (
                                            <option value="" disabled>Нет сотрудников с допуском</option>
                                        )}
                                    </select>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {(employees.find(e => e.id === selectedEmpId)?.clearances || []).map(c => (
                                            <span key={c} className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded uppercase font-bold">
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <span className="text-sm text-slate-600 dark:text-slate-300 font-bold">Ручная настройка часов</span>
                                    <button
                                        onClick={() => setIsManual(!isManual)}
                                        className={`w-10 h-5 rounded-full transition-colors relative ${isManual ? 'bg-blue-600' : (theme === 'dark' ? 'bg-slate-600' : 'bg-slate-100')}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isManual ? 'left-6' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                {!isManual ? (
                                    <div>
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Тип смены</label>
                                        <select id="type-select" className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                                            <option value="Day">День (08:00 - 20:00)</option>
                                            <option value="Night">Ночь (20:00 - 08:00)</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Начало</label>
                                            <input id="start-time" type="time" defaultValue="09:00" className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Конец</label>
                                            <input id="end-time" type="time" defaultValue="18:00" className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                                        </div>
                                    </div>
                                )}

                                <div className="flex space-x-3 pt-4">
                                    <button
                                        onClick={async () => {
                                            const empId = selectedEmpId;
                                            const areaId = selectedAreaId;
                                            if (selectedDate) {
                                                let success = false;
                                                if (isManual) {
                                                    const start = (document.getElementById('start-time') as HTMLInputElement).value;
                                                    const end = (document.getElementById('end-time') as HTMLInputElement).value;
                                                    success = await onAssign(empId, selectedDate, 'Custom', areaId, start, end);
                                                } else {
                                                    const type = (document.getElementById('type-select') as HTMLSelectElement).value as 'Day' | 'Night';
                                                    success = await onAssign(empId, selectedDate, type, areaId);
                                                }

                                                if (success) {
                                                    setSelectedDate(null);
                                                    setIsManual(false);
                                                    setIsAddingNew(false);
                                                }
                                            }
                                        }}
                                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                                    >
                                        Назначить
                                    </button>
                                    <button
                                        onClick={() => setIsAddingNew(false)}
                                        className={`flex-1 py-2 rounded-lg font-bold transition-all border-none ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
