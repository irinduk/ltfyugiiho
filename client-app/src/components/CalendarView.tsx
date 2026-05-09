import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, XCircle, Check, X, ArrowLeft, ArrowLeftRight, Trash2 } from 'lucide-react';
// import { motion } from 'motion/react';
import { Employee, Shift, Role, Vacation } from '../types';
import { WORK_AREAS } from '../constants';

interface CalendarViewProps {
    role: Role;
    user: Employee;
    shifts: Shift[];
    vacations: Vacation[];
    employees: Employee[];
    onAssign: (id: string, date: string, type: 'Day' | 'Night' | 'Custom', workAreaId: string, start?: string, end?: string, isOvertime?: boolean) => Promise<boolean> | boolean;
    onSwapRequest: (id: string) => void;
    onReassign: (shiftId: string, targetId: string) => void;
    onDelete: (shiftId: string) => void;
    defaultShiftHours: number;
    theme: 'dark' | 'light';
    filterEmployeeId?: string | null;
    onClearFilter?: () => void;
    fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
    onVacationsChange: (vacations: Vacation[]) => void;
}

export function CalendarView({
    role,
    user,
    shifts,
    vacations,
    employees,
    onAssign,
    onSwapRequest,
    onReassign,
    onDelete,
    defaultShiftHours,
    theme,
    filterEmployeeId = null,
    onClearFilter,
    fetchWithAuth,
    onVacationsChange
}: CalendarViewProps) {
    const MIN_VACATION_YEAR = 1999;
    const MIN_VACATION_DATE = `${MIN_VACATION_YEAR}-01-01`;
    const MAX_VACATION_DATE = `${new Date().getFullYear() + 1}-12-31`;
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [isManual, setIsManual] = useState(false);
    const [showOnlyMine, setShowOnlyMine] = useState(false);
    const [reassigningShift, setReassigningShift] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [selectedEmpId, setSelectedEmpId] = useState<string>(employees.filter(e => e.role === 'Engineer')[0]?.id || '');
    const [selectedAreaId, setSelectedAreaId] = useState<string>(WORK_AREAS[0]?.id || '');
    const [calendarMode, setCalendarMode] = useState<'shifts' | 'vacations'>('shifts');
    const [vacationStart, setVacationStart] = useState<string>('');
    const [vacationEnd, setVacationEnd] = useState<string>('');
    const [leaveType, setLeaveType] = useState<'Annual' | 'Maternity' | 'Sick' | 'Unpaid' | 'Study' | 'Other'>('Annual');
    const [plannerEmployeeId, setPlannerEmployeeId] = useState<string>(employees.filter(e => e.role === 'Engineer')[0]?.id || '');
    const [editingVacation, setEditingVacation] = useState<Vacation | null>(null);
    const [editLeaveType, setEditLeaveType] = useState<'Annual' | 'Maternity' | 'Sick' | 'Unpaid' | 'Study' | 'Other'>('Annual');
    const [editStart, setEditStart] = useState('');
    const [editEnd, setEditEnd] = useState('');
    const [isOvertimeAssign, setIsOvertimeAssign] = useState(false);

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

    useEffect(() => {
        if (calendarMode === 'vacations') {
            reloadVacations();
        }
    }, [calendarMode]);

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

    const addHoursToTime = (base: string, hours: number) => {
        const [h, m] = base.split(':').map(n => parseInt(n, 10));
        const total = ((h * 60 + m) + hours * 60) % (24 * 60);
        const hh = String(Math.floor(total / 60)).padStart(2, '0');
        const mm = String(total % 60).padStart(2, '0');
        return `${hh}:${mm}`;
    };

    const getTimeRange = (shift: Shift) => {
        if (shift.type === 'Custom') return shift.startTime && shift.endTime ? `${shift.startTime} - ${shift.endTime}` : '';
        if (shift.type === 'Day') {
            const start = shift.startTime || '08:00';
            const end = shift.endTime || addHoursToTime(start, defaultShiftHours);
            return `${start} - ${end}`;
        }
        const start = shift.startTime || '20:00';
        const end = shift.endTime || addHoursToTime(start, defaultShiftHours);
        return `${start} - ${end}`;
    };

    const getDayShifts = (date: string) => {
        let filtered = shifts.filter(s => {
            const shiftDate = s.date ? s.date.split('T')[0] : '';
            return shiftDate === date;
        });
        if (filterEmployeeId) {
            filtered = filtered.filter(s => String(s.employeeId).toLowerCase() === String(filterEmployeeId).toLowerCase());
        } else if (showOnlyMine && role === 'Engineer') {
            filtered = filtered.filter(s => String(s.employeeId).toLowerCase() === String(user.id).toLowerCase());
        }
        return filtered;
    };

    const getDayVacations = (date: string) => {
        return vacations.filter(v => {
            const start = v.startDate;
            const end = v.endDate;
            if (!start || !end) return false;
            return date >= start && date <= end;
        });
    };

    const reloadVacations = async () => {
        try {
            const res = await fetchWithAuth('/api/vacations');
            if (!res.ok) return;
            const data = await res.json();
            onVacationsChange(Array.isArray(data) ? data : []);
        } catch { }
    };

    const requestVacation = async () => {
        if (!vacationStart || !vacationEnd) return;
        const startYear = Number(vacationStart.slice(0, 4));
        const endYear = Number(vacationEnd.slice(0, 4));
        const nextYear = new Date().getFullYear() + 1;
        if (Number.isNaN(startYear) || Number.isNaN(endYear) || startYear < MIN_VACATION_YEAR || endYear < MIN_VACATION_YEAR) {
            window.alert(`Год отпуска не может быть меньше ${MIN_VACATION_YEAR}`);
            return;
        }
        if (endYear > nextYear || vacationEnd > `${nextYear}-12-31`) {
            window.alert(`Дата окончания не может быть позже ${nextYear}-12-31`);
            return;
        }
        const body = { employeeId: user.id, leaveType, startDate: vacationStart, endDate: vacationEnd };
        const res = await fetchWithAuth('/api/vacations', { method: 'POST', body: JSON.stringify(body) });
        if (res.ok) {
            setVacationStart('');
            setVacationEnd('');
            setLeaveType('Annual');
            await reloadVacations();
        }
    };

    const handleVacationStartChange = (value: string) => {
        setVacationStart(value);
        if (!vacationEnd || vacationEnd < value) {
            setVacationEnd(value);
        }
    };

    const plannerCreateVacation = async () => {
        if (!plannerEmployeeId || !vacationStart || !vacationEnd) return;
        const startYear = Number(vacationStart.slice(0, 4));
        const endYear = Number(vacationEnd.slice(0, 4));
        const nextYear = new Date().getFullYear() + 1;
        if (Number.isNaN(startYear) || Number.isNaN(endYear) || startYear < MIN_VACATION_YEAR || endYear < MIN_VACATION_YEAR) {
            window.alert(`Год отпуска не может быть меньше ${MIN_VACATION_YEAR}`);
            return;
        }
        if (endYear > nextYear || vacationEnd > `${nextYear}-12-31`) {
            window.alert(`Дата окончания не может быть позже ${nextYear}-12-31`);
            return;
        }
        const body = {
            employeeId: plannerEmployeeId,
            leaveType,
            startDate: vacationStart,
            endDate: vacationEnd,
            status: 'Approved'
        };
        const res = await fetchWithAuth('/api/vacations/plan', { method: 'POST', body: JSON.stringify(body) });
        if (res.ok) {
            setVacationStart('');
            setVacationEnd('');
            await reloadVacations();
        }
    };

    const setVacationStatus = async (id: number, status: 'Approved' | 'Rejected') => {
        const res = await fetchWithAuth(`/api/vacations/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        if (res.ok) {
            await reloadVacations();
        }
    };

    const deleteVacation = async (id: number) => {
        if (!window.confirm('Удалить отпуск?')) return;
        const res = await fetchWithAuth(`/api/vacations/${id}`, { method: 'DELETE' });
        if (res.ok) await reloadVacations();
    };

    const openEditVacation = (current: Vacation) => {
        setEditingVacation(current);
        setEditLeaveType((current.leaveType as any) || 'Annual');
        setEditStart(current.startDate);
        setEditEnd(current.endDate);
    };

    const saveEditVacation = async () => {
        if (!editingVacation) return;
        if (!editStart || !editEnd) return;
        const startYear = Number(editStart.slice(0, 4));
        const endYear = Number(editEnd.slice(0, 4));
        const nextYear = new Date().getFullYear() + 1;
        if (Number.isNaN(startYear) || Number.isNaN(endYear) || startYear < MIN_VACATION_YEAR || endYear < MIN_VACATION_YEAR) {
            window.alert(`Год отпуска не может быть меньше ${MIN_VACATION_YEAR}`);
            return;
        }
        if (endYear > nextYear || editEnd > `${nextYear}-12-31`) {
            window.alert(`Дата окончания не может быть позже ${nextYear}-12-31`);
            return;
        }
        const res = await fetchWithAuth(`/api/vacations/${editingVacation.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                leaveType: editLeaveType,
                startDate: editStart,
                endDate: editEnd,
                status: editingVacation.status
            })
        });
        if (res.ok) {
            setEditingVacation(null);
            await reloadVacations();
        }
    };

    const leaveTypeRu = (value?: string) => {
        switch (value) {
            case 'Annual': return 'Ежегодный';
            case 'Maternity': return 'Декрет';
            case 'Sick': return 'Больничный';
            case 'Unpaid': return 'Отгул за свой счет';
            case 'Study': return 'Учебный';
            case 'Other': return 'Иной';
            default: return value || 'Отпуск';
        }
    };

    const handlePrevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(year, month + 1, 1));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>График дежурств: {monthNames[month]} {year}</h2>
                <div className="flex items-center space-x-4">
                    <div className={`flex items-center rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                        <button
                            onClick={() => setCalendarMode('shifts')}
                            className={`px-3 py-2 text-xs font-bold ${calendarMode === 'shifts' ? 'bg-blue-600 text-white' : (theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700')}`}
                        >
                            Смены
                        </button>
                        <button
                            onClick={() => setCalendarMode('vacations')}
                            className={`px-3 py-2 text-xs font-bold ${calendarMode === 'vacations' ? 'bg-blue-600 text-white' : (theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-700')}`}
                        >
                            Отпуска
                        </button>
                    </div>
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
                        const dayVacations = getDayVacations(dateStr);
                        const isToday = new Date().toISOString().split('T')[0] === dateStr;
                        const isDraftVacationRange =
                            calendarMode === 'vacations' &&
                            !!vacationStart &&
                            !!vacationEnd &&
                            dateStr >= vacationStart &&
                            dateStr <= vacationEnd;

                        return (
                            <div
                                key={d}
                                onClick={() => {
                                    if (calendarMode !== 'shifts') return;
                                    if (role === 'Manager' || role === 'Admin') setSelectedDate(dateStr);
                                }}
                                className={`min-h-[120px] p-2 border-r border-b transition-colors group relative ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/20' : 'border-slate-100 bg-white hover:bg-slate-50'
                                    } ${(role === 'Manager' || role === 'Admin') && calendarMode === 'shifts' ? 'cursor-pointer' : ''}`}
                            >
                                {isDraftVacationRange && (
                                    <div className={`absolute inset-0 pointer-events-none ${theme === 'dark' ? 'bg-indigo-500/10' : 'bg-indigo-200/35'}`}></div>
                                )}
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-sm font-bold ${isToday ? 'text-blue-600' : (theme === 'dark' ? 'text-slate-500' : 'text-slate-900')}`}>{d}</span>
                                </div>
                                <div className="space-y-1">
                                    {calendarMode === 'shifts' && dayShifts.map(s => {
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
                                                        {s.type === 'Day' ? '☀️' : s.type === 'Night' ? '🌙' : '⏱️'} {(emp?.name || 'Empty').split(' ')[0]} {s.isOvertime ? '• ПЕРЕРАБОТКА' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {calendarMode === 'vacations' && dayVacations.map(v => {
                                        const emp = employees.find(e => String(e.id).toLowerCase() === String(v.employeeId).toLowerCase());
                                        const color = v.status === 'Approved'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : v.status === 'Rejected'
                                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                                        return (
                                            <div
                                                key={String(v.id)}
                                                className={`text-[10px] p-1.5 rounded-md border truncate font-bold ${color}`}
                                                title={`${emp?.name || '—'}: ${v.startDate}..${v.endDate} (${v.status}, ${leaveTypeRu(v.leaveType)})`}
                                            >
                                                {emp?.name?.split(' ')[0] || '—'} {leaveTypeRu(v.leaveType)} ({v.status})
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {calendarMode === 'vacations' && (role === 'Manager' || role === 'Admin') && (
                <div className={`p-4 rounded-2xl border space-y-4 ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
                    <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>График отпусков (менеджер)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                        <div className="md:col-span-2">
                            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Сотрудник</label>
                            <select value={plannerEmployeeId} onChange={(e) => setPlannerEmployeeId(e.target.value)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                                {employees.filter(e => e.role === 'Engineer').map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Тип</label>
                            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as any)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                                <option value="Annual">Ежегодный</option>
                                <option value="Maternity">Декрет</option>
                                <option value="Sick">Больничный</option>
                                <option value="Unpaid">Отгул за свой счет</option>
                                <option value="Study">Учебный</option>
                                <option value="Other">Иной</option>
                            </select>
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Начало</label>
                            <input type="date" min={MIN_VACATION_DATE} max={MAX_VACATION_DATE} value={vacationStart} onChange={(e) => handleVacationStartChange(e.target.value)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Конец</label>
                            <input type="date" min={vacationStart || MIN_VACATION_DATE} max={MAX_VACATION_DATE} value={vacationEnd} onChange={(e) => setVacationEnd(e.target.value)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={plannerCreateVacation} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500">
                            Добавить в график отпусков
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {(['Pending', 'Approved', 'Rejected'] as const).map(status => (
                            <div key={status} className={`p-3 rounded-xl border ${theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                                <p className={`text-xs font-bold uppercase mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>{status === 'Pending' ? 'На согласовании' : status === 'Approved' ? 'Одобренные' : 'Отклоненные'}</p>
                                <div className="space-y-2 max-h-48 overflow-auto">
                                    {vacations.filter(v => v.status === status).map(v => {
                                        const emp = employees.find(e => String(e.id).toLowerCase() === String(v.employeeId).toLowerCase());
                                        return (
                                            <div key={v.id} className={`p-2 rounded border text-xs ${theme === 'dark' ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
                                                <div className="font-bold">{emp?.name || '—'}</div>
                                                <div>{leaveTypeRu(v.leaveType)}: {v.startDate}..{v.endDate}</div>
                                                {status === 'Pending' && (
                                                    <div className="flex gap-2 mt-2">
                                                        <button onClick={() => setVacationStatus(v.id, 'Approved')} className="px-2 py-1 rounded bg-emerald-600 text-white">Одобрить</button>
                                                        <button onClick={() => setVacationStatus(v.id, 'Rejected')} className="px-2 py-1 rounded bg-red-600 text-white">Отклонить</button>
                                                    </div>
                                                )}
                                                {status === 'Approved' && (
                                                    <div className="flex gap-2 mt-2">
                                                        <button onClick={() => openEditVacation(v)} className="px-2 py-1 rounded bg-blue-600 text-white">Редактировать</button>
                                                        <button onClick={() => deleteVacation(v.id)} className="px-2 py-1 rounded bg-red-600 text-white">Удалить</button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {vacations.filter(v => v.status === status).length === 0 && (
                                        <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Нет записей</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {calendarMode === 'vacations' && role === 'Engineer' && (
                <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
                    <h3 className={`text-sm font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Заявка на отпуск</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Тип отпуска</label>
                            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as any)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                                <option value="Annual">Ежегодный</option>
                                <option value="Maternity">Декрет</option>
                                <option value="Sick">Больничный</option>
                                <option value="Unpaid">Отгул за свой счет</option>
                                <option value="Study">Учебный</option>
                                <option value="Other">Иной</option>
                            </select>
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Начало</label>
                            <input type="date" min={MIN_VACATION_DATE} max={MAX_VACATION_DATE} value={vacationStart} onChange={(e) => handleVacationStartChange(e.target.value)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                        </div>
                        <div>
                            <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Конец</label>
                            <input type="date" min={vacationStart || MIN_VACATION_DATE} max={MAX_VACATION_DATE} value={vacationEnd} onChange={(e) => setVacationEnd(e.target.value)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                        </div>
                        <button onClick={requestVacation} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500">
                            Отправить заявку
                        </button>
                    </div>
                </div>
            )}

            {selectedDate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className={`border rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-8 ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-6">
                            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                {isAddingNew ? 'Назначение смены' : 'Детали дня'}: {selectedDate}
                            </h3>
                            <button onClick={() => { setSelectedDate(null); setIsManual(false); setReassigningShift(null); setIsAddingNew(false); setIsOvertimeAssign(false); }} className="text-slate-500 hover:text-blue-500 transition-colors"><XCircle size={24} /></button>
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
                                            <div className="flex justify-end">
                                                <button
                                                    onClick={() => setIsAddingNew(true)}
                                                    className="px-4 py-2 bg-slate-100 dark:bg-blue-600/20 text-slate-600 dark:text-blue-400 rounded-lg border border-slate-300 dark:border-blue-500/30 text-sm hover:bg-slate-200 dark:hover:bg-blue-600/30 transition-all font-bold"
                                                >
                                                    + Добавить смену
                                                </button>
                                            </div>
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
                                                                        {getTimeRange(s)}
                                                                    </p>
                                                                    {s.isOvertime && (
                                                                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Оплата как переработка (1.5x/2x)</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <span className={`text-xs font-bold font-mono text-blue-600 dark:text-blue-400`}>{calculateHours(s)}ч</span>
                                                                {(role === 'Manager' || role === 'Admin') && !isReassigning && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setReassigningShift(s.id)}
                                                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-600/10 rounded transition-colors"
                                                                            title="Переназначить"
                                                                        >
                                                                            <ArrowLeftRight size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => onDelete(s.id)}
                                                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-600/10 rounded transition-colors ml-1"
                                                                            title="Удалить смену"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </>
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
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-sm text-slate-600 dark:text-slate-300 font-bold">Назначить как переработку</span>
                                    <button
                                        onClick={() => setIsOvertimeAssign(!isOvertimeAssign)}
                                        className={`w-10 h-5 rounded-full transition-colors relative ${isOvertimeAssign ? 'bg-amber-500' : (theme === 'dark' ? 'bg-slate-600' : 'bg-slate-100')}`}
                                        title="Переработка позволяет назначать смену сверх ограничений ТК, с повышенной оплатой"
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isOvertimeAssign ? 'left-6' : 'left-1'}`}></div>
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
                                                    success = await onAssign(empId, selectedDate, 'Custom', areaId, start, end, isOvertimeAssign);
                                                } else {
                                                    const type = (document.getElementById('type-select') as HTMLSelectElement).value as 'Day' | 'Night';
                                                    success = await onAssign(empId, selectedDate, type, areaId, undefined, undefined, isOvertimeAssign);
                                                }

                                                if (success) {
                                                    setSelectedDate(null);
                                                    setIsManual(false);
                                                    setIsAddingNew(false);
                                                    setIsOvertimeAssign(false);
                                                }
                                            }
                                        }}
                                        className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                                    >
                                        Назначить
                                    </button>
                                    <button
                                        onClick={() => { setIsAddingNew(false); setIsOvertimeAssign(false); }}
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

            {editingVacation && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className={`border rounded-2xl p-6 w-full max-w-lg shadow-2xl ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Редактирование отпуска</h3>
                            <button onClick={() => setEditingVacation(null)} className="text-slate-500 hover:text-red-500"><XCircle size={22} /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Тип отпуска</label>
                                <select value={editLeaveType} onChange={(e) => setEditLeaveType(e.target.value as any)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}>
                                    <option value="Annual">Ежегодный</option>
                                    <option value="Maternity">Декрет</option>
                                    <option value="Sick">Больничный</option>
                                    <option value="Unpaid">Отгул за свой счет</option>
                                    <option value="Study">Учебный</option>
                                    <option value="Other">Иной</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Начало</label>
                                    <input type="date" min={MIN_VACATION_DATE} max={MAX_VACATION_DATE} value={editStart} onChange={(e) => setEditStart(e.target.value)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Конец</label>
                                    <input type="date" min={editStart || MIN_VACATION_DATE} max={MAX_VACATION_DATE} value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setEditingVacation(null)} className={`px-4 py-2 rounded-lg font-bold ${theme === 'dark' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>Отмена</button>
                                <button onClick={saveEditVacation} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-500">Сохранить</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}