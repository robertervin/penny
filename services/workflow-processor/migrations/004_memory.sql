-- 004_memory.sql
-- User Memory: classification rules, per-transaction overrides, correction audit log.

CREATE TABLE IF NOT EXISTS memory_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  match_field     TEXT NOT NULL DEFAULT 'raw_name'
                  CHECK (match_field IN ('raw_name', 'merchant_name', 'either')),
  match_pattern   TEXT NOT NULL,
  account_id      UUID REFERENCES accounts(id) ON DELETE SET NULL,
  action          TEXT NOT NULL
                  CHECK (action IN ('ignore', 'payroll', 'transfer', 'debt_service')),
  source          TEXT NOT NULL DEFAULT 'user'
                  CHECK (source IN ('user', 'penny_suggested', 'import')),
  source_channel  TEXT,
  created_by      UUID REFERENCES people(id) ON DELETE SET NULL,
  note            TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_rules_household_active_idx
  ON memory_rules(household_id) WHERE active;

CREATE TABLE IF NOT EXISTS transaction_overrides (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id            UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  plaid_transaction_id    TEXT NOT NULL,
  action                  TEXT NOT NULL
                          CHECK (action IN ('ignore', 'payroll', 'transfer', 'debt_service', 'default')),
  reason                  TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, plaid_transaction_id)
);

CREATE TABLE IF NOT EXISTS corrections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id       UUID REFERENCES people(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL,
  raw_input       TEXT,
  parsed_intent   JSONB NOT NULL DEFAULT '{}',
  rule_id         UUID REFERENCES memory_rules(id) ON DELETE SET NULL,
  override_id     UUID REFERENCES transaction_overrides(id) ON DELETE SET NULL,
  undone_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corrections_household_created_idx
  ON corrections(household_id, created_at DESC);
