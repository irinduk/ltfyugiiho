/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Calendar as CalendarIcon,
    Users,
    ShieldCheck,
    FileText,
    Bell,
    LogOut,
    User,
    Settings,
    Database,
    History,
    CheckCircle2,
    AlertTriangle,
    Network,
    Loader2
} from 'lucide-react';

// --- Types & Constants ---
import { Role, Employee, Shift, AuditLog, Notification } from './types';
import { EMPLOYEES, WORK_AREAS, INITIAL_SHIFTS } from './constants';

// --- Components ---
import { SidebarItem } from './components/SidebarItem';
import { Dashboard } from './components/Dashboard';
import { CalendarView } from './components/CalendarView';
import { StaffManagement } from './components/StaffManagement';
import { AuditLogView } from './components/AuditLogView';
import { ReportsView } from './components/ReportsView';
import { DatabaseSchemaView } from './components/DatabaseSchemaView';
import { SecurityPanel } from './components/SecurityPanel';
import { SettingsView } from './components/SettingsView';
import { InfrastructureMap } from './components/InfrastructureMap';
import Login from './components/Login';

export default function App() {
    const [currentUser, setCurrentUser] = useState<any | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [allClearances, setAllClearances] = useState(['Cisco Core', 'Juniper Edge', 'Linux Admin', 'Fortinet NSE', 'Zabbix Expert', 'Postgres Pro']);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [defaultShiftHours, setDefaultShiftHours] = useState(12);
    const [calendarFilterEmpId, setCalendarFilterEmpId] = useState<string | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);

    const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
        const token = localStorage.getItem('token');
        const headers = {
            ...(options.headers || {}),
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        return fetch(url, { ...options, headers });
    };

    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const fetchSafe = async (url: string) => {
                try {
                    const res = await fetchWithAuth(url);
                    if (!res.ok) {
                        if (res.status === 401) {
                            console.warn(`Unauthorized access to ${url}`);
                            if (url === '/api/employees') setCurrentUser(null);
                        }
                        return null;
                    }
                    return await res.json();
                } catch (e) {
                    console.error(`Failed to fetch ${url}`, e);
                    return null;
                }
            };

            const [empData, shiftData, logData, clsData] = await Promise.all([
                fetchSafe('/api/employees'),
                fetchSafe('/api/shifts'),
                fetchSafe('/api/audit'),
                fetchSafe('/api/employees/clearances')
            ]);

            if (empData && Array.isArray(empData)) {
                const mappedEmployees = empData.map((e: any) => ({
                    ...e,
                    id: String(e?.id || '').toLowerCase(),
                    name: e?.name || e?.fullName || e?.full_name || 'Unknown',
                    clearances: e?.clearances || e?.Clearances || []
                }));
                setEmployees(mappedEmployees);
            }

            if (shiftData && Array.isArray(shiftData)) {
                const mappedShifts = shiftData.map((s: any) => {
                    const empId = s?.employeeId ? String(s.employeeId).toLowerCase() : s?.employeeId;
                    return {
                        ...s,
                        id: String(s?.id || '').toLowerCase(),
                        employeeId: empId,
                        date: (s?.date || s?.shiftDate || s?.Date || s?.ShiftDate || '').split('T')[0],
                        type: s?.type || s?.shiftType || s?.Type || s?.ShiftType,
                        status: s?.status || s?.Status || 'Confirmed'
                    };
                });
                setShifts(mappedShifts);
            }

            if (logData) setAuditLogs(logData);
            if (clsData) setAllClearances(clsData);

        } catch (err) {
            console.error('General data sync failed', err);
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchData();
        }
    }, [currentUser]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetchWithAuth('/api/auth/me');
                if (res.ok) {
                    const userData = await res.json();
                    if (userData && userData.id) {
                        userData.id = String(userData.id || '').toLowerCase();
                    }
                    setCurrentUser(userData);
                } else if (res.status === 401) {
                    localStorage.removeItem('token');
                }
            } catch (err) {
                console.error('Auth network/proxy error:', err);
            } finally {
                setIsAuthLoading(false);
            }
        };
        checkAuth();
    }, []);

    const handleLogout = async () => {
        try {
            await fetchWithAuth('/api/auth/logout', { method: 'POST' });
        } catch (err) {
            console.error('Logout failed');
        } finally {
            localStorage.removeItem('token');
            setCurrentUser(null);
            setActiveTab('dashboard');
        }
    };

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            root.style.backgroundColor = '#0f172a';
            root.style.color = '#f8fafc';
        } else {
            root.classList.remove('dark');
            root.style.backgroundColor = '#f8fafc';
            root.style.color = '#0f172a';
        }
    }, [theme]);

    const addNotification = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
        const id = Date.now();
        setNotifications(prev => [{ id, text, type }, ...prev]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    };

    const currentRole = currentUser?.role || 'Engineer';

    const addLog = async (action: string) => {
        const newLog = {
            timestamp: new Date().toISOString(),
            userName: currentUser?.name || 'Unknown',
            action,
            ipAddress: '127.0.0.1'
        };

        try {
            await fetchWithAuth('/api/audit', {
                method: 'POST',
                body: JSON.stringify(newLog)
            });
            fetchData();
        } catch (err) {
            console.error('Logging failed');
        }
    };

    const updateShiftStatus = async (shiftId: string, status: string): Promise<boolean> => {
        try {
            const res = await fetchWithAuth(`/api/shifts/${shiftId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                fetchData();
                return true;
            } else {
                console.error('Ошибка сервера при смене статуса');
                return false;
            }
        } catch (err) {
            console.error('Update status failed', err);
            return false;
        }
    };

    const handleAssignShift = async (employeeId: string, date: string, type: 'Day' | 'Night' | 'Custom', workAreaId: string, startTime?: string, endTime?: string): Promise<boolean> => {
        const employee = employees.find(e => e.id === employeeId);
        const workArea = WORK_AREAS.find(wa => wa.id === workAreaId);
        if (!employee || !workArea) return false;

        const missingClearances = workArea.requiredClearances.filter(c => !(employee.clearances || []).includes(c));
        if (missingClearances.length > 0 && employee.role !== 'Manager' && employee.role !== 'Admin') {
            addNotification(`У ${employee.name} нет допусков: ${missingClearances.join(', ')}!`, 'error');
            return false;
        }

        try {
            const res = await fetchWithAuth('/api/shifts', {
                method: 'POST',
                body: JSON.stringify({
                    employeeId, workAreaId, shiftDate: date, shiftType: type, startTime, endTime, status: 'Confirmed'
                })
            });

            if (res.ok) {
                const newShiftFromServer = await res.json();
                const mappedNewShift = {
                    ...newShiftFromServer,
                    id: String(newShiftFromServer.id).toLowerCase(),
                    employeeId: String(newShiftFromServer.employeeId).toLowerCase(),
                    date: (newShiftFromServer.date || newShiftFromServer.shiftDate || '').split('T')[0],
                    type: newShiftFromServer.type || newShiftFromServer.shiftType,
                    status: newShiftFromServer.status || newShiftFromServer.Status || 'Confirmed'
                };

                setShifts(prev => [...prev, mappedNewShift]);
                addLog(`Назначена смена: ${employee.name} на ${date}`);
                addNotification(`Смена назначена: ${employee.name}`, 'success');
                fetchData();
                return true;
            } else {
                const errData = await res.json().catch(() => ({}));
                addNotification(`Ошибка при назначении: ${errData.error || res.statusText}`, 'error');
                return false;
            }
        } catch (err) {
            addNotification('Ошибка сервера при назначении смены', 'error');
        }
        return false;
    };

    const handleSwapRequest = async (shiftId: string) => {
        const shift = shifts.find(s => s.id === shiftId);
        if (!shift || !currentUser) return;

        if (shift.employeeId !== currentUser.id && currentRole !== 'Admin' && currentRole !== 'Manager') {
            addNotification('Вы не можете запрашивать замену для чужой смены!', 'error');
            return;
        }

        setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: 'PendingSwap' } : s));
        const isSuccess = await updateShiftStatus(shiftId, 'PendingSwap');

        if (isSuccess) {
            addLog(`Запрос на замену смены ${shiftId} от ${currentUser.name}`);
            addNotification('Запрос на замену отправлен', 'info');
        } else {
            setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: shift.status } : s));
            addNotification('Ошибка сервера при запросе замены', 'error');
        }
    };

    const handleApproveSwap = async (shiftId: string, targetEmployeeId: string) => {
        const targetEmp = employees.find(e => e.id === targetEmployeeId);
        if (!targetEmp) return;

        await updateShiftStatus(shiftId, 'Confirmed');
        addLog(`Замена смены ${shiftId} утверждена. Новый исполнитель: ${targetEmp.name}`);
        addNotification(`Смена передана: ${targetEmp.name}`, 'success');
    };

    const handleAddClearanceToEmployee = async (employeeId: string, clearance: string) => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;

        try {
            const newClearances = [...new Set([...(emp.clearances || []), clearance])];
            const res = await fetchWithAuth(`/api/employees/${employeeId}`, {
                method: 'PUT',
                body: JSON.stringify({ ...emp, fullName: emp.name, clearances: newClearances })
            });

            if (res.ok) {
                addLog(`Добавлен допуск "${clearance}" сотруднику ${emp.name}`);
                addNotification(`Допуск "${clearance}" добавлен`, 'success');
                fetchData();
            }
        } catch (err) {
            console.error('Failed to add clearance');
        }
    };

    const handleAddClearanceType = (clearance: string) => {
        if (!allClearances.includes(clearance)) {
            setAllClearances(prev => [...prev, clearance]);
            addLog(`В систему добавлен новый тип допуска: ${clearance}`);
            addNotification(`Тип допуска "${clearance}" создан`, 'success');
        }
    };

    const handleRejectSwap = (shiftId: string) => {
        setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, status: 'Confirmed' } : s));
        updateShiftStatus(shiftId, 'Confirmed');
        addLog(`Замена смены ${shiftId} отклонена`);
        addNotification('Замена отклонена', 'error');
    };

    // ИСПРАВЛЕНО: Теперь отправляем полный объект CreateEmployeeDto
    const handleAddEmployee = async (employeeData: any) => {
        try {
            const res = await fetchWithAuth('/api/employees', {
                method: 'POST',
                body: JSON.stringify(employeeData)
            });

            if (res.ok) {
                addLog(`Создан сотрудник: ${employeeData.email} (${employeeData.role})`);
                addNotification(`Сотрудник ${employeeData.email} успешно добавлен`, 'success');
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                addNotification(err.error || 'Ошибка при создании сотрудника', 'error');
            }
        } catch (err) {
            addNotification('Сбой сети при создании сотрудника', 'error');
        }
    };

    // ИСПРАВЛЕНО: Добавлено поле Email для редактирования
    const handleEditEmployee = async (id: string, name: string, email: string, role: Role, clearances: string[]) => {
        try {
            const res = await fetchWithAuth(`/api/employees/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ id, fullName: name, email, role, clearances })
            });
            if (res.ok) {
                addLog(`Изменены данные сотрудника: ${name}`);
                addNotification(`Данные ${name} обновлены`, 'success');
                fetchData();
            } else {
                const err = await res.json().catch(() => ({}));
                addNotification(err.error || 'Ошибка при обновлении', 'error');
            }
        } catch (err) {
            console.error('Failed to update employee');
        }
    };

    const renderContent = () => {
        if (!currentUser) return null;
        switch (activeTab) {
            case 'dashboard': return <Dashboard role={currentRole} user={currentUser} shifts={shifts} employees={employees} allClearances={allClearances} onApprove={handleApproveSwap} onReject={handleRejectSwap} onAddClearance={handleAddClearanceToEmployee} theme={theme} />;
            case 'calendar': return <CalendarView role={currentRole} user={currentUser} shifts={shifts} employees={employees} onAssign={handleAssignShift} onSwapRequest={handleSwapRequest} onReassign={handleApproveSwap} defaultShiftHours={defaultShiftHours} theme={theme} filterEmployeeId={calendarFilterEmpId} onClearFilter={() => setCalendarFilterEmpId(null)} />;
            case 'staff': return <StaffManagement employees={employees} allClearances={allClearances} onAdd={handleAddEmployee} onEdit={handleEditEmployee} onAddClearanceType={handleAddClearanceType} theme={theme} onViewSchedule={(id) => { setCalendarFilterEmpId(id); setActiveTab('calendar'); }} />;
            case 'audit': return <AuditLogView logs={auditLogs} theme={theme} />;
            case 'reports': return <ReportsView theme={theme} />;
            case 'security': return <SecurityPanel theme={theme} />;
            case 'database': return <DatabaseSchemaView theme={theme} />;
            case 'map': return <InfrastructureMap shifts={shifts} employees={employees} theme={theme} />;
            case 'settings': return <SettingsView theme={theme} setTheme={setTheme} defaultShiftHours={defaultShiftHours} setDefaultShiftHours={setDefaultShiftHours} role={currentRole} />;
            default: return <Dashboard role={currentRole} user={currentUser} shifts={shifts} employees={employees} allClearances={allClearances} onApprove={handleApproveSwap} onReject={handleRejectSwap} onAddClearance={handleAddClearanceToEmployee} theme={theme} />;
        }
    };

    if (isAuthLoading) {
        return (
            <div className={`h-screen flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-[#0f172a]' : 'bg-slate-50'}`}>
                <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
                <p className="text-slate-500 font-mono text-xs">INITIALIZING TERMINAL...</p>
            </div>
        );
    }

    if (!currentUser) {
        return <Login onLogin={(userData) => {
            setCurrentUser(userData);

            // ИСПРАВЛЕНО: Интеграция 152-ФЗ (Устаревание пароля)
            if (userData.requirePasswordChange) {
                setTimeout(() => {
                    addNotification('ВНИМАНИЕ: Срок действия пароля истек (90 дней). Пожалуйста, смените пароль в настройках безопасности!', 'error');
                }, 500);
            }
        }} theme={theme} />;
    }

    return (
        <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0f172a] text-slate-200' : 'bg-white text-slate-900'}`}>
            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className={`p-4 rounded-xl shadow-2xl border flex items-center space-x-3 pointer-events-auto min-w-[300px] ${n.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                            n.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            }`}
                    >
                        {n.type === 'success' && <CheckCircle2 size={20} />}
                        {n.type === 'error' && <AlertTriangle size={20} />}
                        {n.type === 'info' && <Bell size={20} />}
                        <span className="text-sm font-medium">{n.text}</span>
                    </div>
                ))}
            </div>

            {/* Sidebar */}
            <aside className={`w-64 border-r flex flex-col p-4 transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center space-x-3 px-2 mb-10">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                        <ShieldCheck className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className={`font-bold text-lg leading-tight ${theme === 'dark' ? 'text-white' : 'text-black'}`}>NOC Control</h1>
                        <p className={`text-xs uppercase tracking-wider font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Secure Panel</p>
                    </div>
                </div>

                <nav className="flex-1 space-y-2">
                    <SidebarItem
                        icon={LayoutDashboard}
                        label="Дашборд"
                        active={activeTab === 'dashboard'}
                        onClick={() => setActiveTab('dashboard')}
                        theme={theme}
                    />
                    <SidebarItem
                        icon={CalendarIcon}
                        label="Расписание"
                        active={activeTab === 'calendar'}
                        onClick={() => setActiveTab('calendar')}
                        theme={theme}
                    />
                    <SidebarItem
                        icon={Network}
                        label="Карта сети"
                        active={activeTab === 'map'}
                        onClick={() => setActiveTab('map')}
                        theme={theme}
                    />

                    {(currentRole === 'Manager' || currentRole === 'Admin') && (
                        <>
                            <SidebarItem
                                icon={Users}
                                label="Персонал"
                                active={activeTab === 'staff'}
                                onClick={() => setActiveTab('staff')}
                                theme={theme}
                            />
                            <SidebarItem
                                icon={Database}
                                label="База данных"
                                active={activeTab === 'database'}
                                onClick={() => setActiveTab('database')}
                                theme={theme}
                            />
                            <SidebarItem
                                icon={FileText}
                                label="Отчеты"
                                active={activeTab === 'reports'}
                                onClick={() => setActiveTab('reports')}
                                theme={theme}
                            />
                            <SidebarItem
                                icon={Settings}
                                label="Настройки"
                                active={activeTab === 'settings'}
                                onClick={() => setActiveTab('settings')}
                                theme={theme}
                            />
                        </>
                    )}

                    {currentRole === 'Admin' && (
                        <>
                            <SidebarItem
                                icon={History}
                                label="Аудит"
                                active={activeTab === 'audit'}
                                onClick={() => setActiveTab('audit')}
                                theme={theme}
                            />
                            <SidebarItem
                                icon={Settings}
                                label="Безопасность"
                                active={activeTab === 'security'}
                                onClick={() => setActiveTab('security')}
                                theme={theme}
                            />
                        </>
                    )}
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center space-x-3 px-2 mb-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-900'}`}>
                            <User size={16} />
                        </div>
                        <div className="overflow-hidden">
                            <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{currentUser.name}</p>
                            <p className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>{currentRole}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center space-x-3 px-4 py-2 transition-colors font-bold ${theme === 'dark' ? 'text-slate-400 hover:text-red-400' : 'text-black hover:text-red-600'}`}
                    >
                        <LogOut size={18} />
                        <span className="text-sm">Выход</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Header / Role Switcher for Demo */}
                <header className={`h-16 backdrop-blur-md border-b flex items-center justify-between px-8 z-10 transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1e293b]/50 border-slate-800' : 'bg-white/70 border-slate-200'}`}>
                    <div className="flex items-center space-x-4">
                        <h2 className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900'}`}>Оперативный пульт управления</h2>
                    </div>

                    <div className="flex items-center space-x-6">
                        <div className="relative">
                            <Bell size={20} className={`${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-900 hover:text-black'} cursor-pointer`} />
                            {currentUser?.requirePasswordChange && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                            )}
                        </div>
                        <div className={`h-8 w-[1px] ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900'}`}>SERVER: ONLINE</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    <div key={activeTab + currentRole}>
                        {renderContent()}
                    </div>
                </div>
            </main>
        </div>
    );
}