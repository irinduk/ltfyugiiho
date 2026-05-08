import React, { useState } from 'react';
import { Employee, Role } from '../types';

interface StaffManagementProps {
    employees: Employee[];
    allClearances: string[];
    onAdd: (data: any) => void;
    onEdit: (id: string, name: string, email: string, role: Role, clearances: string[]) => void;
    onAddClearanceType: (c: string) => void;
    onViewSchedule: (id: string) => void;
    theme: 'dark' | 'light';
}

export function StaffManagement({
    employees,
    allClearances,
    onAdd,
    onEdit,
    onAddClearanceType,
    onViewSchedule,
    theme
}: StaffManagementProps) {
    const [showAdd, setShowAdd] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [newClearance, setNewClearance] = useState('');

    const validatePassword = (password: string): string | null => {
        if (password.length < 8) return 'Пароль должен быть не менее 8 символов';
        if (/\s/.test(password)) return 'Пароль не должен содержать пробелы';
        if (!/[A-Z]/.test(password)) return 'Добавьте хотя бы одну заглавную латинскую букву (A-Z)';
        if (!/[a-z]/.test(password)) return 'Добавьте хотя бы одну строчную латинскую букву (a-z)';
        if (!/\d/.test(password)) return 'Добавьте хотя бы одну цифру';
        if (!/[^A-Za-z0-9]/.test(password)) return 'Добавьте хотя бы один спецсимвол';
        return null;
    };

    const handleAddClearance = () => {
        if (newClearance) {
            onAddClearanceType(newClearance);
            setNewClearance('');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Управление персоналом</h2>
                <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-900/20 font-bold">
                    Добавить сотрудника
                </button>
            </div>

            <div className={`rounded-2xl border overflow-hidden shadow-sm dark:shadow-xl ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                <table className="w-full text-left">
                    <thead className={`border-b ${theme === 'dark' ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-200/50 border-slate-200'}`}>
                        <tr>
                            <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Сотрудник</th>
                            <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Email</th>
                            <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Роль</th>
                            <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Допуски</th>
                            <th className={`px-6 py-4 text-xs font-bold uppercase text-right tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Действия</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-200'}`}>
                        {employees.map(e => (
                            <tr key={e.id} className={`transition-colors ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'bg-white hover:bg-slate-50'}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-900 text-white shadow-sm'}`}>
                                            {(e.name || 'U').split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <span className="font-bold text-slate-900 dark:text-white">{e.name || 'Unknown'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                    {e.email || 'Не указан'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-xs px-2 py-1 rounded-md border font-bold ${e.role === 'Manager' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' :
                                        e.role === 'Admin' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                                            'bg-white text-slate-900 dark:text-blue-400 border-slate-200'
                                        }`}>
                                        {e.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                        {(e.clearances || []).map(c => (
                                            <span key={c} className={`text-[9px] px-1.5 py-0.5 border rounded uppercase font-bold tracking-tighter ${theme === 'dark' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white text-black border-slate-300 shadow-sm'}`}>
                                                {c}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end space-x-3">
                                        <button
                                            onClick={() => onViewSchedule(e.id)}
                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold transition-colors"
                                        >
                                            График
                                        </button>
                                        <button
                                            onClick={() => setEditingEmployee(e)}
                                            className="text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold transition-colors"
                                        >
                                            Изменить
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {(showAdd || editingEmployee) && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
                        <h3 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {editingEmployee ? 'Редактировать сотрудника' : 'Новый сотрудник'}
                        </h3>

                        <div className="space-y-6">
                            {editingEmployee ? (
                                // ФОРМА РЕДАКТИРОВАНИЯ (Компактная)
                                <div className="space-y-4">
                                    <div>
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>ФИО</label>
                                        <input id="edit-emp-name" type="text" defaultValue={editingEmployee.name || ''} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Корпоративная почта</label>
                                        <input id="edit-emp-email" type="email" defaultValue={editingEmployee.email || ''} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Роль</label>
                                        <select id="edit-emp-role" defaultValue={editingEmployee.role || 'Engineer'} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500">
                                            <option value="Engineer">Инженер</option>
                                            <option value="Manager">Руководитель</option>
                                            <option value="Admin">Администратор</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                // ФОРМА ДОБАВЛЕНИЯ НОВОГО (Разделенная по 152-ФЗ)
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Корпоративная почта (Логин) *</label>
                                        <input id="add-emp-email" type="email" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" placeholder="ivanov@noc.ru" required />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Фамилия *</label>
                                        <input id="add-emp-last" type="text" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" required />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Имя *</label>
                                        <input id="add-emp-first" type="text" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" required />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Отчество</label>
                                        <input id="add-emp-patr" type="text" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Роль</label>
                                        <select id="add-emp-role" defaultValue="Engineer" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500">
                                            <option value="Engineer">Инженер</option>
                                            <option value="Manager">Руководитель</option>
                                            <option value="Admin">Администратор</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Временный пароль (будет зашифрован) *</label>
                                        <input id="add-emp-pass" type="text" className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" required />
                                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                            Минимум 8 символов, A-Z, a-z, цифра и спецсимвол, без пробелов.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                                <label className={`block text-xs font-bold uppercase mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Допуски и сертификаты</label>
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    {allClearances.map(c => (
                                        <label key={c} className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200">
                                            <input type="checkbox" className="clearance-checkbox w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500" value={c} defaultChecked={(editingEmployee?.clearances || []).includes(c)} />
                                            <span>{c}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        value={newClearance}
                                        onChange={(e) => setNewClearance(e.target.value)}
                                        placeholder="Новый тип допуска..."
                                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs outline-none focus:border-blue-500 text-slate-900 dark:text-white"
                                    />
                                    <button
                                        onClick={handleAddClearance}
                                        className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-white rounded-lg text-xs hover:bg-slate-200 transition-colors font-bold border border-slate-200 dark:border-transparent"
                                    >
                                        Добавить в список
                                    </button>
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-4">
                                <button
                                    onClick={() => {
                                        // Сбор общих данных
                                        const checkboxes = document.querySelectorAll('.clearance-checkbox:checked');
                                        const clearances = Array.from(checkboxes).map((cb: any) => cb.value);

                                        if (editingEmployee) {
                                            const name = (document.getElementById('edit-emp-name') as HTMLInputElement).value;
                                            const email = (document.getElementById('edit-emp-email') as HTMLInputElement).value;
                                            const role = (document.getElementById('edit-emp-role') as HTMLSelectElement).value as Role;

                                            if (name && email) {
                                                onEdit(editingEmployee.id, name, email, role, clearances);
                                                setShowAdd(false);
                                                setEditingEmployee(null);
                                            }
                                        } else {
                                            const email = (document.getElementById('add-emp-email') as HTMLInputElement).value;
                                            const lastName = (document.getElementById('add-emp-last') as HTMLInputElement).value;
                                            const firstName = (document.getElementById('add-emp-first') as HTMLInputElement).value;
                                            const patronymic = (document.getElementById('add-emp-patr') as HTMLInputElement).value;
                                            const role = (document.getElementById('add-emp-role') as HTMLSelectElement).value as Role;
                                            const tempPassword = (document.getElementById('add-emp-pass') as HTMLInputElement).value;

                                            if (email && lastName && firstName && tempPassword) {
                                                const passwordError = validatePassword(tempPassword);
                                                if (passwordError) {
                                                    alert(passwordError);
                                                    return;
                                                }

                                                const newEmployeeData = { lastName, firstName, patronymic, email, role, tempPassword, clearances };
                                                onAdd(newEmployeeData);
                                                setShowAdd(false);
                                            } else {
                                                alert("Заполните все обязательные поля (*)");
                                            }
                                        }
                                    }}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                                >
                                    {editingEmployee ? 'Сохранить изменения' : 'Создать учетную запись'}
                                </button>
                                <button onClick={() => { setShowAdd(false); setEditingEmployee(null); }} className="flex-1 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-transparent">Отмена</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}