import type { Db } from "./pool.js";
import type { MemoryAction } from "../interpret/classifyTransaction.js";

export type MemoryRuleRow = {
  id: string;
  household_id: string;
  match_field: "raw_name" | "merchant_name" | "either";
  match_pattern: string;
  account_id: string | null;
  action: MemoryAction;
  source: string;
  source_channel: string | null;
  created_by: string | null;
  note: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type CorrectionRow = {
  id: string;
  household_id: string;
  person_id: string | null;
  channel: string;
  raw_input: string | null;
  parsed_intent: Record<string, unknown>;
  rule_id: string | null;
  override_id: string | null;
  undone_at: Date | null;
  created_at: Date;
};

export function toMemoryRule(row: MemoryRuleRow) {
  return {
    id: row.id,
    matchField: row.match_field,
    matchPattern: row.match_pattern,
    accountId: row.account_id,
    action: row.action,
  };
}

export async function listActiveMemoryRules(
  pool: Db,
  householdId: string,
): Promise<MemoryRuleRow[]> {
  const { rows } = await pool.query<MemoryRuleRow>(
    `SELECT * FROM memory_rules
     WHERE household_id = $1 AND active = true
     ORDER BY created_at ASC`,
    [householdId],
  );
  return rows;
}

export async function listMemoryRules(
  pool: Db,
  householdId: string,
): Promise<MemoryRuleRow[]> {
  const { rows } = await pool.query<MemoryRuleRow>(
    `SELECT * FROM memory_rules
     WHERE household_id = $1
     ORDER BY created_at DESC`,
    [householdId],
  );
  return rows;
}

export async function insertMemoryRule(
  pool: Db,
  row: {
    householdId: string;
    matchField?: "raw_name" | "merchant_name" | "either";
    matchPattern: string;
    accountId?: string | null;
    action: MemoryAction;
    source?: string;
    sourceChannel?: string | null;
    createdBy?: string | null;
    note?: string | null;
  },
): Promise<MemoryRuleRow> {
  const { rows } = await pool.query<MemoryRuleRow>(
    `INSERT INTO memory_rules (
       household_id, match_field, match_pattern, account_id, action,
       source, source_channel, created_by, note
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      row.householdId,
      row.matchField ?? "either",
      row.matchPattern.trim().toUpperCase(),
      row.accountId ?? null,
      row.action,
      row.source ?? "user",
      row.sourceChannel ?? null,
      row.createdBy ?? null,
      row.note ?? null,
    ],
  );
  return rows[0]!;
}

export async function deactivateMemoryRule(
  pool: Db,
  householdId: string,
  ruleId: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE memory_rules SET active = false, updated_at = now()
     WHERE id = $1 AND household_id = $2 AND active = true`,
    [ruleId, householdId],
  );
  return (rowCount ?? 0) > 0;
}

export async function listTransactionOverrides(pool: Db, householdId: string) {
  const { rows } = await pool.query<{
    plaid_transaction_id: string;
    action: MemoryAction | "default";
  }>(
    `SELECT plaid_transaction_id, action FROM transaction_overrides
     WHERE household_id = $1`,
    [householdId],
  );
  return rows.map((r) => ({
    plaidTransactionId: r.plaid_transaction_id,
    action: r.action,
  }));
}

export async function insertCorrection(
  pool: Db,
  row: {
    householdId: string;
    personId?: string | null;
    channel: string;
    rawInput?: string | null;
    parsedIntent: Record<string, unknown>;
    ruleId?: string | null;
    overrideId?: string | null;
  },
): Promise<CorrectionRow> {
  const { rows } = await pool.query<CorrectionRow>(
    `INSERT INTO corrections (
       household_id, person_id, channel, raw_input, parsed_intent, rule_id, override_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      row.householdId,
      row.personId ?? null,
      row.channel,
      row.rawInput ?? null,
      JSON.stringify(row.parsedIntent),
      row.ruleId ?? null,
      row.overrideId ?? null,
    ],
  );
  return rows[0]!;
}

export async function getLastUndoableCorrection(
  pool: Db,
  householdId: string,
): Promise<CorrectionRow | null> {
  const { rows } = await pool.query<CorrectionRow>(
    `SELECT * FROM corrections
     WHERE household_id = $1 AND undone_at IS NULL AND rule_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [householdId],
  );
  return rows[0] ?? null;
}

export async function markCorrectionUndone(pool: Db, correctionId: string): Promise<void> {
  await pool.query(
    `UPDATE corrections SET undone_at = now() WHERE id = $1`,
    [correctionId],
  );
}

export async function loadMemoryForHousehold(pool: Db, householdId: string) {
  const [rules, overrides] = await Promise.all([
    listActiveMemoryRules(pool, householdId),
    listTransactionOverrides(pool, householdId),
  ]);
  return {
    rules: rules.map(toMemoryRule),
    overrides,
  };
}
