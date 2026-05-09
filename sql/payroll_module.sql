-- Payroll module for NOC_Management_App
-- Run manually in PostgreSQL (psql/pgAdmin).

BEGIN;

CREATE TABLE IF NOT EXISTS payroll_rates (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    work_area_id VARCHAR(50) NULL,
    amount_per_shift NUMERIC(12, 2) NOT NULL CHECK (amount_per_shift > 0),
    base_hours NUMERIC(6, 2) NOT NULL DEFAULT 12 CHECK (base_hours > 0),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_rates_grade ON payroll_rates(grade_id);
CREATE INDEX IF NOT EXISTS idx_payroll_rates_work_area ON payroll_rates(work_area_id);
CREATE INDEX IF NOT EXISTS idx_payroll_rates_effective ON payroll_rates(effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_rates_active ON payroll_rates(is_active);

-- Безопасная миграция для уже существующей таблицы.
ALTER TABLE payroll_rates ADD COLUMN IF NOT EXISTS grade_id INTEGER;
ALTER TABLE payroll_rates ADD COLUMN IF NOT EXISTS base_hours NUMERIC(6, 2) NOT NULL DEFAULT 12;

CREATE TABLE IF NOT EXISTS payroll_report_runs (
    id BIGSERIAL PRIMARY KEY,
    generated_by UUID NULL REFERENCES employees(id) ON DELETE SET NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_employees INTEGER NOT NULL DEFAULT 0,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_payroll_report_period CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_payroll_report_runs_period ON payroll_report_runs(period_start, period_end);

COMMIT;
