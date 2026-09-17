-- 005_situation_classified.sql
-- Situation v2: classified buckets and operating runway.

ALTER TABLE situations
  ADD COLUMN IF NOT EXISTS classified JSONB NOT NULL DEFAULT '{}';

ALTER TABLE situations
  ADD COLUMN IF NOT EXISTS monthly_operating_outflow_cents BIGINT;

ALTER TABLE situations
  ADD COLUMN IF NOT EXISTS monthly_payroll_inflow_cents BIGINT;

ALTER TABLE situations
  ADD COLUMN IF NOT EXISTS operating_runway_months NUMERIC(8, 2);
