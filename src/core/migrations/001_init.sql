-- 001_init.sql
-- Canonical ledger + Plaid connection state for vertical slice 1.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS people (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS households (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS household_members (
  household_id  UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'owner',
  PRIMARY KEY (household_id, person_id)
);

CREATE TABLE IF NOT EXISTS plaid_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id            UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id               UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  plaid_item_id           TEXT NOT NULL UNIQUE,
  institution_id          TEXT,
  institution_name        TEXT,
  status                  TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'needs_reauth', 'unlinked', 'error')),
  access_token_encrypted  TEXT NOT NULL,
  txn_cursor              TEXT,
  last_synced_at          TIMESTAMPTZ,
  last_error_code         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plaid_items_household_idx ON plaid_items(household_id);

CREATE TABLE IF NOT EXISTS accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  plaid_item_id       UUID REFERENCES plaid_items(id) ON DELETE SET NULL,
  plaid_account_id    TEXT UNIQUE,
  name                TEXT NOT NULL,
  official_name       TEXT,
  mask                TEXT,
  type                TEXT NOT NULL,
  subtype             TEXT,
  iso_currency_code   TEXT NOT NULL DEFAULT 'USD',
  include_in_runway   BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_household_idx ON accounts(household_id);
CREATE INDEX IF NOT EXISTS accounts_plaid_item_idx ON accounts(plaid_item_id);

CREATE TABLE IF NOT EXISTS balance_snapshots (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  as_of               TIMESTAMPTZ NOT NULL,
  available_cents     BIGINT,
  current_cents       BIGINT,
  limit_cents         BIGINT,
  iso_currency_code   TEXT NOT NULL DEFAULT 'USD',
  sync_attempt_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS balance_snapshots_account_as_of_idx
  ON balance_snapshots(account_id, as_of DESC);

CREATE TABLE IF NOT EXISTS transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plaid_transaction_id    TEXT NOT NULL UNIQUE,
  amount_cents            BIGINT NOT NULL,
  iso_currency_code       TEXT NOT NULL DEFAULT 'USD',
  posted_date             DATE NOT NULL,
  datetime                TIMESTAMPTZ,
  pending                 BOOLEAN NOT NULL DEFAULT false,
  pending_transaction_id  TEXT,
  raw_name                TEXT,
  merchant_name           TEXT,
  payment_channel         TEXT,
  removed_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_account_date_idx
  ON transactions(account_id, posted_date DESC);

CREATE TABLE IF NOT EXISTS sync_attempts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_item_id       UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  event_id            UUID NOT NULL,
  correlation_id      UUID,
  cursor_before       TEXT,
  cursor_after        TEXT,
  payload_ref         TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'fetched'
                      CHECK (status IN ('fetched', 'committed', 'failed')),
  accounts_expected   INT NOT NULL DEFAULT 0,
  accounts_ingested   INT NOT NULL DEFAULT 0,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sync_attempts_event_id_idx ON sync_attempts(event_id);
CREATE INDEX IF NOT EXISTS sync_attempts_item_status_idx ON sync_attempts(plaid_item_id, status);

CREATE TABLE IF NOT EXISTS processed_events (
  event_id      UUID PRIMARY KEY,
  source        TEXT NOT NULL,
  detail_type   TEXT NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_webhook_id TEXT,
  body          JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
