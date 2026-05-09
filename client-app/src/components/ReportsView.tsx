import React, { useState } from 'react';
import { CheckCircle2, Download } from 'lucide-react';

interface ReportsViewProps {
    theme: 'dark' | 'light';
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

export function ReportsView({ theme, fetchWithAuth }: ReportsViewProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportType, setReportType] = useState('summary');
    const [reportFormat, setReportFormat] = useState('csv');
    const [startDate, setStartDate] = useState('2026-04-01');
    const [endDate, setEndDate] = useState('2026-04-30');
    const [reportRows, setReportRows] = useState<any[]>([]);
    const [summaryKpi, setSummaryKpi] = useState<any | null>(null);
    const [reportError, setReportError] = useState<string | null>(null);

    const toCsv = (rows: any[]) => {
      if (!rows.length) return '';
      const headers = Object.keys(rows[0]);
      const escapeCsv = (value: any) => {
        const text = value == null ? '' : String(value);
        return `"${text.replace(/"/g, '""')}"`;
      };
      const lines = [
        headers.map(escapeCsv).join(';'),
        ...rows.map(row => headers.map(h => escapeCsv(row[h])).join(';'))
      ];
      // CRLF improves compatibility with spreadsheet editors on Windows.
      return lines.join('\r\n');
    };

    const downloadFile = (content: string, filename: string, mimeType: string) => {
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    };

    const handleGenerateReport = async () => {
        setReportError(null);
        setIsGenerating(true);
        try {
          const query = `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
          const endpoint = reportType === 'vacations'
              ? '/api/reports/vacations-summary?' + query
              : reportType === 'overtime'
                ? '/api/reports/overtime-summary?' + query
                : '/api/reports/shifts-summary?' + query;

          const res = await fetchWithAuth(endpoint);
          if (!res.ok) {
            throw new Error('Не удалось сформировать отчет');
          }

          const payload = await res.json();
          const normalizedRows = reportType === 'summary'
            ? (Array.isArray(payload?.employees) ? payload.employees : [])
            : (Array.isArray(payload) ? payload : []);
          const kpi = reportType === 'summary' ? (payload?.kpi || null) : null;
          setSummaryKpi(kpi);
          setReportRows(normalizedRows);

          const stamp = new Date().toISOString().slice(0, 10);
          const filenameBase = `report_${reportType}_${stamp}`;
          if (reportFormat === 'json') {
            const jsonPayload = reportType === 'summary' ? { kpi, employees: normalizedRows } : normalizedRows;
            downloadFile(JSON.stringify(jsonPayload, null, 2), `${filenameBase}.json`, 'application/json;charset=utf-8');
          } else {
            let csv = toCsv(normalizedRows);
            if (reportType === 'summary' && kpi) {
              const kpiRows = [
                ['KPI', 'Значение'],
                ['Всего отработано смен', kpi.totalShifts ?? 0],
                ['Всего человеко-часов', kpi.totalHours ?? 0],
                ['Часы переработок', kpi.overtimeHours ?? 0],
                ['Количество замен (Swaps)', kpi.totalSwaps ?? 0]
              ];
              const kpiCsv = kpiRows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
              csv = `${kpiCsv}\r\n\r\n${csv}`;
            }
            // UTF-8 BOM prevents mojibake for Cyrillic text in Excel.
            downloadFile(`\uFEFF${csv}`, `${filenameBase}.csv`, 'text/csv;charset=utf-8');
          }
        } catch (error: any) {
          setReportError(error?.message || 'Ошибка формирования отчета');
        } finally {
          setIsGenerating(false);
        }
    };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Отчетность и аналитика</h2>
        <div className="flex space-x-3">
          <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400 text-xs flex items-center font-bold">
            <CheckCircle2 size={14} className="mr-2" />
            Экономия ФОТ: +12% (за счет снижения переработок)
          </div>
        </div>
      </div>

      <div className={`p-6 rounded-2xl border shadow-sm dark:shadow-xl ${theme === 'dark' ? 'bg-[#1e293b] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-6 rounded-2xl border shadow-sm col-span-2 ${theme === 'dark' ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-white transition-shadow hover:shadow-md'}`}>
            <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Генерация отчета</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Тип отчета</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`}
                >
                  <option value="summary">Сводка по сменам</option>
                  <option value="vacations">Отчет по отпускам</option>
                  <option value="overtime">Отчет по переработкам</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Формат</label>
                <select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value)}
                  className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`}
                >
                  <option value="csv">CSV Data</option>
                  <option value="json">JSON Data</option>
                </select>
              </div>
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Период</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`} />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`} />
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/10' : 'bg-white border-slate-200 shadow-sm'}`}>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-black font-bold'}`}>
                <span className="font-bold text-blue-600 dark:text-blue-400">Примечание:</span> Отчет включает данные из Postgres Pro и логи аудита. Соответствует требованиям 152-ФЗ (обезличивание ПДн при экспорте).
              </p>
            </div>
                          <button
                              onClick={handleGenerateReport}
                              disabled={isGenerating}
                              className="w-full py-2 bg-blue-600 rounded-lg font-bold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center"
                          >
                              {isGenerating ? (
                                  <>
                                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Формирование...
                                  </>
                              ) : (
                                  <>
                                      <Download size={18} className="mr-2" />
                                      Сформировать отчет
                                  </>
                              )}
                          </button>

                      </div>
            {reportError && (
              <div className="text-sm text-red-500 font-medium">{reportError}</div>
            )}
            {!reportError && reportRows.length > 0 && (
              <div className={`p-3 rounded-xl border text-xs ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                Сформировано строк: {reportRows.length}
              </div>
            )}
            {reportType === 'summary' && summaryKpi && (
              <div className={`p-4 rounded-xl border text-xs ${theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                <div>Смен: <b>{summaryKpi.totalShifts ?? 0}</b></div>
                <div>Человеко-часов: <b>{summaryKpi.totalHours ?? 0}</b></div>
                <div>Переработка (ч): <b>{summaryKpi.overtimeHours ?? 0}</b></div>
                <div>Замен (Swaps): <b>{summaryKpi.totalSwaps ?? 0}</b></div>
              </div>
            )}
        </div>
          <div className={`p-6 rounded-2xl border shadow-sm flex flex-col ${theme === 'dark' ? 'bg-slate-800/40 border-slate-700' : 'bg-white border-white transition-shadow hover:shadow-md'}`}>
            <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>KPI Месяца</h3>
          <div className="flex-1 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className={`font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Нарушения графика</span>
                <span className="text-green-600 dark:text-green-400 font-bold">0%</span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div className="h-full bg-green-500 w-full"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className={`font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Загрузка инженеров</span>
                <span className="text-slate-900 dark:text-blue-400 font-bold">84%</span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div className="h-full bg-blue-500 w-[84%]"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className={`font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Успешные замены</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">92%</span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`}>
                <div className="h-full bg-indigo-500 w-[92%]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
