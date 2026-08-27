-- 003_situation.sql
-- Interpreted household state (Situation) derived from the ledger.

CREATE TABLE IF NOT EXISTS situations (
  household_id              UUID PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  version                   INT NOT NULL DEFAULT 1,
  computed_at               TIMESTAMPTZ NOT NULL,
  trigger_event_id          UUID,
  sync_attempt_id           UUID REFERENCES sync_attempts(id) ON DELETE SET NULL,

  liquid_cents              BIGINT,
  monthly_outflow_cents     BIGINT,
  monthly_inflow_cents      BIGINT,
  runway_months             NUMERIC(8, 2),

  debt_posture              JSONB NOT NULL DEFAULT '{}',
  income_shape              JSONB NOT NULL DEFAULT '{}',
  liquidity_map             JSONB NOT NULL DEFAULT '{}',
  recurring_commitments     JSONB NOT NULL DEFAULT '{}',
  duplicate_candidates      JSONB NOT NULL DEFAULT '[]',
  meta                      JSONB NOT NULL DEFAULT '{}',

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS situations_computed_at_idx ON situations(computed_at DESC);
