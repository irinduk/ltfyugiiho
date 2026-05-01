import React from 'react';

interface DatabaseSchemaViewProps {
  theme: 'dark' | 'light';
}

export function DatabaseSchemaView({ theme }: DatabaseSchemaViewProps) {
  const schema = `
-- Схема базы данных ИС Планирования NOC (PostgreSQL Standard)
-- Проект: Дипломная работа

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Справочник рабочих зон (объектов)
CREATE TABLE work_areas (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    required_clearances TEXT[] NOT NULL,
    color VARCHAR(20)
);

-- 2. Таблица сотрудников
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('Engineer', 'Manager', 'Admin')),
    email VARCHAR(255) UNIQUE NOT NULL,
    last_rest_hours INTEGER DEFAULT 24
);

-- 3. Таблица смен
CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id),
    work_area_id VARCHAR(50) REFERENCES work_areas(id),
    shift_date DATE NOT NULL,
    shift_type VARCHAR(20) CHECK (shift_type IN ('Day', 'Night', 'Custom')),
    status VARCHAR(20) DEFAULT 'Confirmed'
);

-- 4. Связь сотрудников и допусков
CREATE TABLE employee_clearances (
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    clearance_id INTEGER REFERENCES clearance_types(id) ON DELETE CASCADE,
    PRIMARY KEY (employee_id, clearance_id)
);
  `;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Архитектура БД (PostgreSQL)</h2>
          <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-700'}`}>Для дипломного проекта: Стандартная реляционная модель</p>
        </div>
        <div className="flex space-x-2">
                <span className={`text-[10px] uppercase tracking-widest font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                  Open Source Standard
                </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm dark:shadow-xl">
            <div className="bg-white dark:bg-slate-800/50 px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider">SQL Setup Script</span>
              <button className="text-[10px] text-slate-500 dark:text-blue-400 hover:text-slate-800 dark:hover:text-blue-300 font-bold uppercase">Копировать</button>
            </div>
            <pre className={`p-6 text-[11px] font-mono overflow-x-auto leading-relaxed max-h-[600px] ${theme === 'dark' ? 'text-slate-300' : 'text-black font-semibold'}`}>
              {schema.trim()}
            </pre>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-xl">
            <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-700'}`}>Связи (Relationships)</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-emerald-500/10 rounded flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">1:N</div>
                <div>
                  <p className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>WorkAreas -&gt; Shifts</p>
                  <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-50' : 'text-black'}`}>Каждая смена привязана к конкретной зоне ответственности.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-500/10 rounded flex items-center justify-center text-blue-600 dark:text-blue-400 text-[10px] font-bold">1:N</div>
                <div>
                  <p className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Employees -&gt; Shifts</p>
                  <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-50' : 'text-black'}`}>Один сотрудник может иметь много смен в графике.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-purple-500/10 rounded flex items-center justify-center text-purple-600 dark:text-purple-400 text-[10px] font-bold">M:N</div>
                <div>
                  <p className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>Employees &lt;-&gt; Clearances</p>
                  <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-50' : 'text-black'}`}>Сотрудник может иметь много допусков, и допуск может быть у многих.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-blue-600/10 p-6 rounded-2xl border border-slate-200 dark:border-blue-500/20 shadow-sm dark:shadow-xl">
            <h3 className={`text-sm font-bold uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-blue-400' : 'text-slate-600'}`}>Для диплома</h3>
            <p className={`text-xs leading-relaxed mb-4 font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900'}`}>
              В пояснительной записке укажите, что база данных нормализована до <b>3-й нормальной формы (3NF)</b>.
            </p>
            <div className="p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
              <p className={`text-[10px] italic font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>"Использование UUID вместо SERIAL повышает безопасность системы, делая идентификаторы непредсказуемыми для злоумышленника."</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
