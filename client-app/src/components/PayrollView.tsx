import React, { useState, useEffect } from 'react';
import { DollarSign, Calculator, TrendingUp, Trash2 } from 'lucide-react';
import { WORK_AREAS } from '../constants';

interface PayrollViewProps {
    theme: 'dark' | 'light';
    fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

export function PayrollView({ theme, fetchWithAuth }: PayrollViewProps) {
    const [rates, setRates] = useState<any[]>([]);
    const [summary, setSummary] = useState<any[]>([]);
    const [grades, setGrades] = useState<any[]>([]);

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    const [summaryWorkAreaId, setSummaryWorkAreaId] = useState('');
    const [summaryGradeId, setSummaryGradeId] = useState('');

    const [newRate, setNewRate] = useState({
        gradeId: '',
        workAreaId: '',
        amountPerShift: '',
        baseHours: '12',
        effectiveFrom: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [rRes, gRes] = await Promise.all([
                fetchWithAuth('/api/payroll/rates'),
                fetchWithAuth('/api/payroll/grades')
            ]);
            if (rRes.ok) setRates(await rRes.json());
            if (gRes.ok) setGrades(await gRes.json());
            await handleGenerateReport();
        } catch (err) {
            console.error(err);
        }
    };

    const handleGenerateReport = async () => {
        const params = new URLSearchParams({
            startDate,
            endDate
        });
        if (summaryWorkAreaId) params.set('workAreaId', summaryWorkAreaId);
        if (summaryGradeId) params.set('gradeId', summaryGradeId);

        const res = await fetchWithAuth(`/api/payroll/summary?${params.toString()}`);
        if (res.ok) {
            const rows = await res.json();
            const mapped = Array.isArray(rows) ? rows.map((s: any) => ({
                employeeId: String(s.employeeId ?? s.EmployeeId ?? ''),
                employeeName: String(s.employeeName ?? s.EmployeeName ?? ''),
                gradeName: String(s.gradeName ?? s.GradeName ?? ''),
                totalShifts: Number(s.totalShifts ?? s.TotalShifts ?? 0),
                totalHours: Number(s.totalHours ?? s.TotalHours ?? 0),
                overtimeHours: Number(s.overtimeHours ?? s.OvertimeHours ?? 0),
                totalSalary: Number(s.totalSalary ?? s.TotalSalary ?? 0)
            })) : [];
            setSummary(mapped);
        }
    };

    const downloadSummaryCsv = () => {
        if (!summary.length) return;
        const headers = ['Сотрудник', 'Грейд', 'Смен', 'Часы', 'Переработка_ч', 'Итого_руб'];
        const lines = [
            headers.join(';'),
            ...summary.map((s) => [
                s.employeeName,
                s.gradeName || '',
                s.totalShifts,
                Number(s.totalHours).toFixed(2),
                Number(s.overtimeHours).toFixed(2),
                Number(s.totalSalary).toFixed(2)
            ].join(';'))
        ];
        const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payroll_${startDate}_${endDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleAddRate = async () => {
        if (!newRate.gradeId || !newRate.amountPerShift) return;
        const res = await fetchWithAuth('/api/payroll/rates', {
            method: 'POST',
            body: JSON.stringify({
                ...newRate,
                gradeId: parseInt(newRate.gradeId),
                amountPerShift: parseFloat(newRate.amountPerShift),
                baseHours: parseFloat(newRate.baseHours)
            })
        });
        if (res.ok) {
            setNewRate({ ...newRate, amountPerShift: '' });
            loadData();
        }
    };

    const handleDeleteRate = async (id: number) => {
        if (!window.confirm("Удалить этот тариф? Он перестанет действовать.")) return;
        const res = await fetchWithAuth(`/api/payroll/rates/${id}`, { method: 'DELETE' });
        if (res.ok) loadData();
    };

    return (
        <div className="space-y-8 pb-10">

            {/* БОЛЬШАЯ ПЛАШКА ДОБАВЛЕНИЯ ТАРИФА */}
            <div className={`p-8 rounded-3xl border shadow-lg ${theme === 'dark' ? 'bg-[#1e293b] border-slate-700' : 'bg-gradient-to-br from-blue-50 to-white border-blue-100'}`}>
                <h2 className={`text-2xl font-black mb-6 ${theme === 'dark' ? 'text-white' : 'text-blue-900'}`}>Назначить новый тариф</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                    <div>
                        <label className="block text-xs font-bold uppercase mb-2 text-slate-500">Грейд (Уровень)</label>
                        <select
                            value={newRate.gradeId}
                            onChange={e => setNewRate({ ...newRate, gradeId: e.target.value })}
                            className={`w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                        >
                            <option value="">Выберите грейд...</option>
                            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-2 text-slate-500">Объект (Зона)</label>
                        <select
                            value={newRate.workAreaId}
                            onChange={e => setNewRate({ ...newRate, workAreaId: e.target.value })}
                            className={`w-full p-3 rounded-xl border text-sm focus:ring-2 focus:ring-blue-500 outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                        >
                            <option value="">Любой (Базовая ставка)</option>
                            {WORK_AREAS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-2 text-slate-500">Ставка (₽)</label>
                        <input
                            type="number"
                            value={newRate.amountPerShift}
                            onChange={e => setNewRate({ ...newRate, amountPerShift: e.target.value })}
                            className={`w-full p-3 rounded-xl border text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-2 text-slate-500">За (часов)</label>
                        <input
                            type="number"
                            value={newRate.baseHours}
                            onChange={e => setNewRate({ ...newRate, baseHours: e.target.value })}
                            className={`w-full p-3 rounded-xl border text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                        />
                    </div>
                </div>
                <button
                    onClick={handleAddRate}
                    className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/30"
                >
                    Утвердить тариф
                </button>
            </div>

            {/* СПИСОК ТАРИФОВ */}
            <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
                <h3 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Актуальные тарифы</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`text-left border-b ${theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-500'}`}>
                                <th className="pb-3 font-bold">Грейд</th>
                                <th className="pb-3 font-bold">Объект</th>
                                <th className="pb-3 font-bold text-right">Ставка</th>
                                <th className="pb-3 font-bold text-center">Часы</th>
                                <th className="pb-3 font-bold text-right">Действие</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {rates.map(r => (
                                <tr key={r.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="py-4 font-bold text-blue-500">{r.gradeName}</td>
                                    <td className="py-4 font-bold">{r.workAreaId ? WORK_AREAS.find(a => a.id === r.workAreaId)?.name : 'Любой объект'}</td>
                                    <td className="py-4 text-right font-mono font-bold text-lg">{Number(r.amountPerShift || 0).toLocaleString()} ₽</td>
                                    <td className="py-4 text-center text-slate-500 font-mono">{r.baseHours}ч</td>
                                    <td className="py-4 text-right">
                                        <button onClick={() => handleDeleteRate(r.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all">
                                            <Trash2 size={20} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {rates.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-500 italic">Нет действующих тарифов</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ОТЧЕТ */}
            <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Итоговый расчет зарплат</h2>
                    <div className="flex items-center space-x-2">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white" />
                        <select
                            value={summaryGradeId}
                            onChange={(e) => setSummaryGradeId(e.target.value)}
                            className="border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        >
                            <option value="">Все грейды</option>
                            {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <select
                            value={summaryWorkAreaId}
                            onChange={(e) => setSummaryWorkAreaId(e.target.value)}
                            className="border rounded-lg p-2 text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        >
                            <option value="">Все объекты</option>
                            {WORK_AREAS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <button
                            onClick={handleGenerateReport}
                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 text-sm font-bold flex items-center gap-2"
                            title="Обновить расчет по выбранным фильтрам"
                        >
                            <Calculator size={18} />
                            Обновить расчет
                        </button>
                        <button onClick={downloadSummaryCsv} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-bold">CSV</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`text-left border-b ${theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-500'}`}>
                                <th className="pb-4 font-bold">Сотрудник</th>
                                <th className="pb-4 font-bold">Грейд</th>
                                <th className="pb-4 font-bold text-center">Смен</th>
                                <th className="pb-4 font-bold text-center">Часы (факт)</th>
                                <th className="pb-4 font-bold text-center">Переработка (ч)</th>
                                <th className="pb-4 font-bold text-right">Итого к выплате</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {summary.map(s => (
                                <tr key={s.employeeId}>
                                    <td className="py-4 font-bold">{s.employeeName}</td>
                                    <td className="py-4">{s.gradeName || '—'}</td>
                                    <td className="py-4 text-center font-mono">{s.totalShifts}</td>
                                    <td className="py-4 text-center font-mono text-blue-500 font-bold">{Number(s.totalHours).toFixed(2)} ч</td>
                                    <td className="py-4 text-center font-mono text-amber-500 font-bold">{Number(s.overtimeHours).toFixed(2)} ч</td>
                                    <td className="py-4 text-right font-mono font-bold text-emerald-600 text-lg">
                                        {Number(s.totalSalary).toLocaleString()} ₽
                                    </td>
                                </tr>
                            ))}
                            {summary.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-slate-500 italic">Нет данных за выбранный период</td>
                                </tr>
                            )}
                        </tbody>
                        {summary.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                                    <td className="py-6 font-bold text-lg">ВСЕГО ПО NOC:</td>
                                    <td></td>
                                    <td className="py-6 text-center font-bold text-lg">{summary.reduce((a, b) => a + b.totalShifts, 0)}</td>
                                    <td className="py-6 text-center font-bold text-lg text-blue-500">{summary.reduce((a, b) => a + Number(b.totalHours), 0).toFixed(2)} ч</td>
                                    <td className="py-6 text-center font-bold text-lg text-amber-500">{summary.reduce((a, b) => a + Number(b.overtimeHours), 0).toFixed(2)} ч</td>
                                    <td className="py-6 text-right text-2xl font-black text-emerald-600">
                                        {summary.reduce((a, b) => a + Number(b.totalSalary), 0).toLocaleString()} ₽
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}