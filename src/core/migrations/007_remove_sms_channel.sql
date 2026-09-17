-- Remove the SMS channel surface. The desktop app is the day-one surface instead.
-- thread_sessions is kept: it is channel-agnostic and the app chat needs conversation state.

DROP INDEX IF EXISTS people_phone_e164_idx;
ALTER TABLE people DROP COLUMN IF EXISTS phone_e164;
