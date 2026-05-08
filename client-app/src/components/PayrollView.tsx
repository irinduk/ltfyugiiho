import React, { useEffect, useMemo, useState } from 'react';
import { Download, Trash2, WalletCards } from 'lucide-react';
import { WORK_AREAS } from '../constants';

interface PayrollViewProps {
  theme: 'dark' | 'light';
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

// DTO from backend (camelCase). На всякий случай в маппинге поддерживаем и PascalCase.
export interface PayrollRateDto {
  id: number;
  clearanceId: number;
  clearanceName: string;
  workAreaId: string | null;
  amountPerShift: number;
  effectiveFrom: string;
  isActive: boolean;
}

interface PayrollSummaryRow {
  employeeId: string;
  employeeName: string;
  totalShifts: number;
  totalSalary: number;
  avgShiftRate: number;
}

interface ClearanceTypeDto {
  id: number;
  name: string;
}

const today = new Date().toISOString().slice(0, 10);

export function PayrollView({ theme, fetchWithAuth }: PayrollViewProps) {
  const [startDate, setStartDate] = useState(today.slice(0, 8) + '01');
  const [endDate, setEndDate] = useState(today);
  const [rates, setRates] = useState<PayrollRateDto[]>([]);
  const [summary, setSummary] = useState<PayrollSummaryRow[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearances, setClearances] = useState<ClearanceTypeDto[]>([]);
  const [selectedClearanceId, setSelectedClearanceId] = useState<number | ''>('');
  const [workAreaId, setWorkAreaId] = useState('');
  const [amountPerShift, setAmountPerShift] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(today);

  const normalizeDate = (raw: any): string => {
    if (!raw) return '';
    const value = String(raw);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (value.includes('T')) return value.split('T')[0];
    if (value.includes(' ')) return value.split(' ')[0];
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString().split('T')[0];
  };

  const mapRate = (r: any): PayrollRateDto => {
    const amountRaw = r?.amountPerShift ?? r?.AmountPerShift ?? r?.amount_per_shift;
    const effectiveRaw = r?.effectiveFrom ?? r?.EffectiveFrom ?? r?.effective_from;
    const workAreaRaw = r?.workAreaId ?? r?.WorkAreaId ?? r?.work_area_id ?? null;
    const clearanceIdRaw = r?.clearanceId ?? r?.ClearanceId ?? r?.clearance_id;
    const idRaw = r?.id ?? r?.Id;

    return {
      id: Number(idRaw) || 0,
      clearanceId: Number(clearanceIdRaw) || 0,
      clearanceName: String(r?.clearanceName ?? r?.ClearanceName ?? r?.clearance_name ?? ''),
      workAreaId: workAreaRaw == null || workAreaRaw === '' ? null : String(workAreaRaw),
      amountPerShift: Number(amountRaw) || 0,
      effectiveFrom: normalizeDate(effectiveRaw),
      isActive: Boolean(r?.isActive ?? r?.IsActive ?? r?.is_active ?? true),
    };
  };

  const summaryTotals = useMemo(() => {
    const totalSalary = summary.reduce((acc, row) => acc + Number(row.totalSalary || 0), 0);
    const totalShifts = summary.reduce((acc, row) => acc + Number(row.totalShifts || 0), 0);
    return { totalSalary, totalShifts };
  }, [summary]);

  const loadRates = async () => {
    setLoadingRates(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/payroll/rates');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Не удалось загрузить тарифы');
      const data = await res.json();
      const mapped = Array.isArray(data) ? data.map(mapRate) : [];
      setRates(mapped);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки тарифов');
    } finally {
      setLoadingRates(false);
    }
  };

  const loadClearances = async () => {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/employees/clearances/full');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Не удалось загрузить справочник допусков');
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      const mapped: ClearanceTypeDto[] = rows.map((x: any) => ({
        id: Number(x?.id ?? x?.Id) || 0,
        name: String(x?.name ?? x?.Name ?? ''),
      })).filter(x => x.id > 0 && x.name);
      setClearances(mapped);
      if (selectedClearanceId === '' && mapped.length > 0) setSelectedClearanceId(mapped[0].id);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки допусков');
    }
  };

  const loadSummary = async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const query = `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      const res = await fetchWithAuth(`/api/payroll/summary?${query}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Не удалось загрузить отчет по зарплате');
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      const mapped: PayrollSummaryRow[] = rows.map((r: any) => {
        const totalSalaryRaw = r?.totalSalary ?? r?.TotalSalary ?? r?.total_salary ?? r?.totalAmount ?? r?.TotalAmount ?? 0;
        const totalShiftsRaw = r?.totalShifts ?? r?.TotalShifts ?? r?.total_shifts ?? r?.shiftCount ?? r?.ShiftCount ?? 0;
        const avgRaw = r?.avgShiftRate ?? r?.AvgShiftRate ?? r?.avg_shift_rate ?? r?.averageRate ?? r?.AverageRate ?? 0;
        return {
          employeeId: String(r?.employeeId ?? r?.EmployeeId ?? r?.employee_id ?? ''),
          employeeName: String(r?.employeeName ?? r?.EmployeeName ?? r?.employee_name ?? '—'),
          totalShifts: Number(totalShiftsRaw) || 0,
          totalSalary: Number(totalSalaryRaw) || 0,
          avgShiftRate: Number(avgRaw) || 0,
        };
      });
      setSummary(mapped);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки отчета');
    } finally {
      setLoadingSummary(false);
    }
  };

  const saveRate = async () => {
    setError(null);
    if (selectedClearanceId === '' || Number(selectedClearanceId) <= 0) {
      setError('Выберите допуск');
      return;
    }
    const amount = Number(amountPerShift);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Введите корректную ставку за смену');
      return;
    }

    try {
      const res = await fetchWithAuth('/api/payroll/rates', {
        method: 'POST',
        body: JSON.stringify({
          clearanceId: Number(selectedClearanceId),
          workAreaId: workAreaId || null,
          amountPerShift: amount,
          effectiveFrom
        })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Не удалось сохранить тариф');
      setAmountPerShift('');
      await loadRates();
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения тарифа');
    }
  };

  const deleteRate = async (id: number) => {
    setError(null);
    const confirmed = window.confirm('Удалить (деактивировать) тариф? Он исчезнет из активного списка, но останется в истории.');
    if (!confirmed) return;
    try {
      const res = await fetchWithAuth(`/api/payroll/rates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Не удалось удалить тариф');
      await loadRates();
    } catch (e: any) {
      setError(e?.message || 'Ошибка удаления тарифа');
    }
  };

  useEffect(() => {
    loadClearances();
    loadRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportSummary = () => {
    if (!summary.length) return;
    const header = ['Сотрудник', 'Смены', 'Сумма', 'Средняя ставка'];
    const body = summary.map(row => [
      row.employeeName,
      String(row.totalShifts),
      Number(row.totalSalary || 0).toFixed(2),
      Number(row.avgShiftRate || 0).toFixed(2)
    ]);
    const csv = [header, ...body]
      .map(line => line.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payroll_${startDate}_${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Зарплата и ФОТ</h2>
        <button
          onClick={loadRates}
          disabled={loadingRates}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500"
        >
          {loadingRates ? 'Загрузка тарифов...' : 'Обновить тарифы'}
        </button>
      </div>

      <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Настройка ставки за смену</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            value={selectedClearanceId}
            onChange={(e) => setSelectedClearanceId(e.target.value ? Number(e.target.value) : '')}
            className={`border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
          >
            {clearances.length === 0 && <option value="">Нет допусков</option>}
            {clearances.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={workAreaId}
            onChange={(e) => setWorkAreaId(e.target.value)}
            className={`border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
          >
            <option value="">Все объекты</option>
            {WORK_AREAS.map(area => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amountPerShift}
            onChange={(e) => setAmountPerShift(e.target.value)}
            placeholder="Ставка за смену"
            className={`border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className={`w-full border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            />
            <button onClick={saveRate} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500">
              Сохранить
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-left`}>
                <th className="py-2">Допуск</th>
                <th className="py-2">Объект</th>
                <th className="py-2">Ставка</th>
                <th className="py-2">Действует с</th>
                <th className="py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rates.map(rate => (
                <tr key={rate.id} className="border-t border-slate-700/20">
                  <td className="py-2">{rate.clearanceName}</td>
                  <td className="py-2">{rate.workAreaId || 'Любой'}</td>
                  <td className="py-2">{rate.amountPerShift.toFixed(2)}</td>
                  <td className="py-2">{rate.effectiveFrom}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => deleteRate(rate.id)}
                      className="px-2 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                      title="Удалить (деактивировать)"
                    >
                      <Trash2 size={14} className="inline mr-1" />
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {!rates.length && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">Тарифов пока нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Отчет по зарплате и сменам</h3>
          <button onClick={exportSummary} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-500">
            <Download size={14} className="inline mr-1" /> Экспорт CSV
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`border rounded-lg p-2 text-sm ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`} />
          <button onClick={loadSummary} disabled={loadingSummary} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-500">
            {loadingSummary ? 'Считаю...' : 'Сформировать'}
          </button>
          <div className={`rounded-lg px-3 py-2 flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
            <WalletCards size={16} />
            Итого: {summaryTotals.totalSalary.toFixed(2)} / {summaryTotals.totalShifts} смен
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'} text-left`}>
                <th className="py-2">Сотрудник</th>
                <th className="py-2">Смены</th>
                <th className="py-2">Сумма</th>
                <th className="py-2">Средняя ставка</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(row => (
                <tr key={row.employeeId} className="border-t border-slate-700/20">
                  <td className="py-2">{row.employeeName}</td>
                  <td className="py-2">{row.totalShifts}</td>
                  <td className="py-2">{Number(row.totalSalary).toFixed(2)}</td>
                  <td className="py-2">{Number(row.avgShiftRate).toFixed(2)}</td>
                </tr>
              ))}
              {!summary.length && (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">Нет данных за выбранный период</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && <div className="text-sm text-red-500 font-semibold">{error}</div>}
    </div>
  );
}
