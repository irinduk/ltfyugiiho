import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ReportsViewProps {
  theme: 'dark' | 'light';
}

export function ReportsView({ theme }: ReportsViewProps) {
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
                <select className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`}>
                  <option>Отработанные часы (Учет смен)</option>
                  <option>Статистика замен и ротации</option>
                  <option>Нарушения допусков и ТК РФ</option>
                  <option>Экономическая эффективность (TCO)</option>
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Формат</label>
                <select className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`}>
                  <option>PDF Document</option>
                  <option>Excel Spreadsheet</option>
                  <option>CSV Data</option>
                </select>
              </div>
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase mb-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-900'}`}>Период</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" defaultValue="2026-04-01" className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`} />
                <input type="date" defaultValue="2026-04-30" className={`w-full border rounded-lg p-2 text-sm outline-none focus:border-blue-500 transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'}`} />
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/10' : 'bg-white border-slate-200 shadow-sm'}`}>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-black font-bold'}`}>
                <span className="font-bold text-blue-600 dark:text-blue-400">Примечание:</span> Отчет включает данные из Postgres Pro и логи аудита. Соответствует требованиям 152-ФЗ (обезличивание ПДн при экспорте).
              </p>
            </div>
            <button className="w-full py-2 bg-blue-600 rounded-lg font-bold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">Сформировать отчет</button>
          </div>
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
