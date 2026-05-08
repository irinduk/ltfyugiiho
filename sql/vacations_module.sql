-- Vacations module for NOC_Management_App
-- Run manually in PostgreSQL (psql/pgAdmin).

BEGIN;

CREATE TABLE IF NOT EXISTS vacations (
    id BIGSERIAL PRIMARY KEY,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(32) NOT NULL DEFAULT 'Annual',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE vacations
    ADD COLUMN IF NOT EXISTS leave_type VARCHAR(32) NOT NULL DEFAULT 'Annual';

CREATE INDEX IF NOT EXISTS idx_vacations_employee ON vacations(employee_id);
CREATE INDEX IF NOT EXISTS idx_vacations_period ON vacations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_vacations_status ON vacations(status);

COMMIT;
