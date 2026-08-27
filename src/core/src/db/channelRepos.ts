import type { Db } from "./pool.js";

export type ThreadSessionRow = {
  id: string;
  channel: string;
  external_thread_id: string;
  household_id: string;
  person_id: string;
  mode: string;
  state: Record<string, unknown>;
  messages: unknown[];
  expires_at: Date;
};

export type PendingRuleProposal = {
  rules: Array<{
    matchPattern: string;
    action: string;
    matchField?: string;
    note?: string;
  }>;
};

export async function findPersonByPhone(pool: Db, phoneE164: string) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM people WHERE phone_e164 = $1 LIMIT 1`,
    [phoneE164],
  );
  return rows[0]?.id ?? null;
}

export async function bindPhoneToPerson(
  pool: Db,
  personId: string,
  phoneE164: string,
): Promise<void> {
  await pool.query(`UPDATE people SET phone_e164 = $2 WHERE id = $1`, [personId, phoneE164]);
}

export async function getHouseholdForPerson(pool: Db, personId: string) {
  const { rows } = await pool.query<{ household_id: string }>(
    `SELECT household_id FROM household_members WHERE person_id = $1 LIMIT 1`,
    [personId],
  );
  return rows[0]?.household_id ?? null;
}

export async function resolveHouseholdByPhone(pool: Db, phoneE164: string) {
  const { rows } = await pool.query<{ person_id: string; household_id: string }>(
    `SELECT p.id AS person_id, hm.household_id
     FROM people p
     JOIN household_members hm ON hm.person_id = p.id
     WHERE p.phone_e164 = $1
     LIMIT 1`,
    [phoneE164],
  );
  return rows[0] ?? null;
}

export async function getThreadSession(
  pool: Db,
  channel: string,
  externalThreadId: string,
): Promise<ThreadSessionRow | null> {
  const { rows } = await pool.query<ThreadSessionRow>(
    `SELECT id, channel, external_thread_id, household_id, person_id, mode, state, messages, expires_at
     FROM thread_sessions
     WHERE channel = $1 AND external_thread_id = $2 AND expires_at > now()
     LIMIT 1`,
    [channel, externalThreadId],
  );
  return rows[0] ?? null;
}

export async function upsertThreadSession(
  pool: Db,
  row: {
    channel: string;
    externalThreadId: string;
    householdId: string;
    personId: string;
    mode?: string;
    state?: Record<string, unknown>;
    messages?: unknown[];
    ttlHours?: number;
  },
): Promise<ThreadSessionRow> {
  const ttlHours = row.ttlHours ?? 24;
  const { rows } = await pool.query<ThreadSessionRow>(
    `INSERT INTO thread_sessions (
       channel, external_thread_id, household_id, person_id, mode, state, messages, expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, now() + ($8 || ' hours')::interval)
     ON CONFLICT (channel, external_thread_id) DO UPDATE SET
       household_id = EXCLUDED.household_id,
       person_id = EXCLUDED.person_id,
       mode = EXCLUDED.mode,
       state = EXCLUDED.state,
       messages = EXCLUDED.messages,
       expires_at = EXCLUDED.expires_at,
       updated_at = now()
     RETURNING id, channel, external_thread_id, household_id, person_id, mode, state, messages, expires_at`,
    [
      row.channel,
      row.externalThreadId,
      row.householdId,
      row.personId,
      row.mode ?? "explore",
      JSON.stringify(row.state ?? {}),
      JSON.stringify(row.messages ?? []),
      String(ttlHours),
    ],
  );
  return rows[0]!;
}

export async function clearThreadState(
  pool: Db,
  channel: string,
  externalThreadId: string,
): Promise<void> {
  await pool.query(
    `UPDATE thread_sessions
     SET mode = 'explore', state = '{}', updated_at = now()
     WHERE channel = $1 AND external_thread_id = $2`,
    [channel, externalThreadId],
  );
}
