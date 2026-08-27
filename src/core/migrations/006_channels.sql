-- Channel identity (SMS) and conversation thread state.

ALTER TABLE people ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS people_phone_e164_idx ON people(phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE TABLE IF NOT EXISTS thread_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel             TEXT NOT NULL,
  external_thread_id  TEXT NOT NULL,
  household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  person_id           UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  mode                TEXT NOT NULL DEFAULT 'explore',
  state               JSONB NOT NULL DEFAULT '{}',
  messages            JSONB NOT NULL DEFAULT '[]',
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel, external_thread_id)
);

CREATE INDEX IF NOT EXISTS thread_sessions_household_idx ON thread_sessions(household_id);
CREATE INDEX IF NOT EXISTS thread_sessions_expires_idx ON thread_sessions(expires_at);
