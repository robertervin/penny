import type pg from "pg";
import type { Db } from "./pool.js";

export type PlaidItemRow = {
  id: string;
  household_id: string;
  person_id: string;
  plaid_item_id: string;
  institution_id: string | null;
  institution_name: string | null;
  status: string;
  access_token_encrypted: string;
  txn_cursor: string | null;
};

export async function getPlaidItemForUpdate(
  client: pg.PoolClient,
  plaidItemId: string,
): Promise<PlaidItemRow | null> {
  const { rows } = await client.query<PlaidItemRow>(
    `SELECT id, household_id, person_id, plaid_item_id, institution_id, institution_name,
            status, access_token_encrypted, txn_cursor
     FROM plaid_items
     WHERE id = $1
     FOR UPDATE`,
    [plaidItemId],
  );
  return rows[0] ?? null;
}

export async function markItemNeedsReauth(
  client: pg.PoolClient,
  itemId: string,
  errorCode: string,
): Promise<void> {
  await client.query(
    `UPDATE plaid_items
     SET status = 'needs_reauth', last_error_code = $2, updated_at = now()
     WHERE id = $1`,
    [itemId, errorCode],
  );
}

export async function updateItemCursor(
  client: pg.PoolClient,
  itemId: string,
  cursor: string,
): Promise<void> {
  await client.query(
    `UPDATE plaid_items
     SET txn_cursor = $2, last_synced_at = now(), last_error_code = NULL,
         status = 'active', updated_at = now()
     WHERE id = $1`,
    [itemId, cursor],
  );
}

export async function insertSyncAttempt(
  client: pg.PoolClient,
  row: {
    id: string;
    plaidItemId: string;
    eventId: string;
    correlationId?: string;
    cursorBefore: string | null;
    cursorAfter: string;
    payloadRef: string;
    accountsExpected: number;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO sync_attempts (
       id, plaid_item_id, event_id, correlation_id, cursor_before, cursor_after,
       payload_ref, status, accounts_expected
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'fetched',$8)`,
    [
      row.id,
      row.plaidItemId,
      row.eventId,
      row.correlationId ?? null,
      row.cursorBefore,
      row.cursorAfter,
      row.payloadRef,
      row.accountsExpected,
    ],
  );
}

export async function getSyncAttempt(pool: Db, id: string) {
  const { rows } = await pool.query(
    `SELECT * FROM sync_attempts WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function markSyncAttemptCommitted(
  client: pg.PoolClient,
  id: string,
  accountsIngested: number,
): Promise<void> {
  await client.query(
    `UPDATE sync_attempts
     SET status = 'committed', accounts_ingested = $2, updated_at = now()
     WHERE id = $1`,
    [id, accountsIngested],
  );
}

export async function tryMarkEventProcessed(
  pool: Db,
  eventId: string,
  source: string,
  detailType: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO processed_events (event_id, source, detail_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, source, detailType],
  );
  return (rowCount ?? 0) > 0;
}

export async function upsertAccount(
  client: pg.PoolClient,
  row: {
    householdId: string;
    plaidItemId: string;
    plaidAccountId: string;
    name: string;
    officialName?: string | null;
    mask?: string | null;
    type: string;
    subtype?: string | null;
    isoCurrencyCode?: string;
  },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO accounts (
       household_id, plaid_item_id, plaid_account_id, name, official_name,
       mask, type, subtype, iso_currency_code
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (plaid_account_id) DO UPDATE SET
       name = EXCLUDED.name,
       official_name = EXCLUDED.official_name,
       mask = EXCLUDED.mask,
       type = EXCLUDED.type,
       subtype = EXCLUDED.subtype,
       updated_at = now()
     RETURNING id`,
    [
      row.householdId,
      row.plaidItemId,
      row.plaidAccountId,
      row.name,
      row.officialName ?? null,
      row.mask ?? null,
      row.type,
      row.subtype ?? null,
      row.isoCurrencyCode ?? "USD",
    ],
  );
  return rows[0]!.id;
}

export async function insertBalanceSnapshot(
  client: pg.PoolClient,
  row: {
    accountId: string;
    asOf: string;
    availableCents: number | null;
    currentCents: number | null;
    limitCents: number | null;
    isoCurrencyCode: string;
    syncAttemptId: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO balance_snapshots (
       account_id, as_of, available_cents, current_cents, limit_cents,
       iso_currency_code, sync_attempt_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      row.accountId,
      row.asOf,
      row.availableCents,
      row.currentCents,
      row.limitCents,
      row.isoCurrencyCode,
      row.syncAttemptId,
    ],
  );
}

export async function upsertTransaction(
  client: pg.PoolClient,
  row: {
    accountId: string;
    plaidTransactionId: string;
    amountCents: number;
    isoCurrencyCode: string;
    postedDate: string;
    datetime?: string | null;
    pending: boolean;
    pendingTransactionId?: string | null;
    rawName?: string | null;
    merchantName?: string | null;
    paymentChannel?: string | null;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO transactions (
       account_id, plaid_transaction_id, amount_cents, iso_currency_code,
       posted_date, datetime, pending, pending_transaction_id, raw_name,
       merchant_name, payment_channel, removed_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL)
     ON CONFLICT (plaid_transaction_id) DO UPDATE SET
       amount_cents = EXCLUDED.amount_cents,
       iso_currency_code = EXCLUDED.iso_currency_code,
       posted_date = EXCLUDED.posted_date,
       datetime = EXCLUDED.datetime,
       pending = EXCLUDED.pending,
       pending_transaction_id = EXCLUDED.pending_transaction_id,
       raw_name = EXCLUDED.raw_name,
       merchant_name = EXCLUDED.merchant_name,
       payment_channel = EXCLUDED.payment_channel,
       removed_at = NULL,
       updated_at = now()`,
    [
      row.accountId,
      row.plaidTransactionId,
      row.amountCents,
      row.isoCurrencyCode,
      row.postedDate,
      row.datetime ?? null,
      row.pending,
      row.pendingTransactionId ?? null,
      row.rawName ?? null,
      row.merchantName ?? null,
      row.paymentChannel ?? null,
    ],
  );
}

export async function softDeleteTransaction(
  client: pg.PoolClient,
  plaidTransactionId: string,
): Promise<void> {
  await client.query(
    `UPDATE transactions
     SET removed_at = now(), updated_at = now()
     WHERE plaid_transaction_id = $1 AND removed_at IS NULL`,
    [plaidTransactionId],
  );
}

/** Test/bootstrap helper: create person + household + plaid item. */
export async function seedPlaidConnection(
  pool: Db,
  opts: {
    personId?: string;
    householdId?: string;
    itemId?: string;
    plaidItemExternalId: string;
    accessTokenEncrypted: string;
    accounts?: Array<{
      plaidAccountId: string;
      name: string;
      type: string;
      subtype?: string;
      mask?: string;
    }>;
  },
): Promise<{ personId: string; householdId: string; itemId: string }> {
  const personId = opts.personId ?? crypto.randomUUID();
  const householdId = opts.householdId ?? crypto.randomUUID();
  const itemId = opts.itemId ?? crypto.randomUUID();

  await pool.query(`INSERT INTO people (id) VALUES ($1) ON CONFLICT DO NOTHING`, [personId]);
  await pool.query(`INSERT INTO households (id) VALUES ($1) ON CONFLICT DO NOTHING`, [householdId]);
  await pool.query(
    `INSERT INTO household_members (household_id, person_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [householdId, personId],
  );
  await pool.query(
    `INSERT INTO plaid_items (
       id, household_id, person_id, plaid_item_id, access_token_encrypted, status
     ) VALUES ($1,$2,$3,$4,$5,'active')
     ON CONFLICT (plaid_item_id) DO UPDATE SET access_token_encrypted = EXCLUDED.access_token_encrypted`,
    [itemId, householdId, personId, opts.plaidItemExternalId, opts.accessTokenEncrypted],
  );

  for (const acct of opts.accounts ?? []) {
    await pool.query(
      `INSERT INTO accounts (
         household_id, plaid_item_id, plaid_account_id, name, mask, type, subtype
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (plaid_account_id) DO NOTHING`,
      [
        householdId,
        itemId,
        acct.plaidAccountId,
        acct.name,
        acct.mask ?? null,
        acct.type,
        acct.subtype ?? null,
      ],
    );
  }

  return { personId, householdId, itemId };
}

const LOCAL_DEV_REF = "local-dev";

/** Single-user local bootstrap (Link UI). */
export async function getOrCreateLocalHousehold(
  pool: Db,
  externalRef = LOCAL_DEV_REF,
): Promise<{ personId: string; householdId: string }> {
  const existing = await pool.query<{ person_id: string; household_id: string }>(
    `SELECT hm.person_id, hm.household_id
     FROM people p
     JOIN household_members hm ON hm.person_id = p.id
     WHERE p.external_ref = $1
     LIMIT 1`,
    [externalRef],
  );
  if (existing.rows[0]) {
    return {
      personId: existing.rows[0].person_id,
      householdId: existing.rows[0].household_id,
    };
  }

  const personId = crypto.randomUUID();
  const householdId = crypto.randomUUID();
  await pool.query(`INSERT INTO people (id, external_ref) VALUES ($1, $2)`, [
    personId,
    externalRef,
  ]);
  await pool.query(`INSERT INTO households (id) VALUES ($1)`, [householdId]);
  await pool.query(
    `INSERT INTO household_members (household_id, person_id) VALUES ($1, $2)`,
    [householdId, personId],
  );
  return { personId, householdId };
}

export async function insertPlaidItem(
  pool: Db,
  row: {
    householdId: string;
    personId: string;
    plaidItemExternalId: string;
    accessTokenEncrypted: string;
    institutionId?: string | null;
    institutionName?: string | null;
  },
): Promise<{ itemId: string }> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO plaid_items (
       id, household_id, person_id, plaid_item_id, institution_id, institution_name,
       access_token_encrypted, status
     ) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,'active')
     ON CONFLICT (plaid_item_id) DO UPDATE SET
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       institution_id = EXCLUDED.institution_id,
       institution_name = EXCLUDED.institution_name,
       status = 'active',
       updated_at = now()
     RETURNING id`,
    [
      row.householdId,
      row.personId,
      row.plaidItemExternalId,
      row.institutionId ?? null,
      row.institutionName ?? null,
      row.accessTokenEncrypted,
    ],
  );
  return { itemId: rows[0]!.id };
}

export async function listPlaidItemsForHousehold(pool: Db, householdId: string) {
  const { rows } = await pool.query(
    `SELECT id, plaid_item_id, institution_id, institution_name, status,
            last_synced_at, created_at
     FROM plaid_items
     WHERE household_id = $1
     ORDER BY created_at DESC`,
    [householdId],
  );
  return rows;
}

export async function countLedgerForHousehold(pool: Db, householdId: string) {
  const { rows } = await pool.query<{
    accounts: string;
    transactions: string;
    latest_balance: Date | null;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM accounts WHERE household_id = $1) AS accounts,
       (SELECT COUNT(*)::text FROM transactions t
        JOIN accounts a ON a.id = t.account_id
        WHERE a.household_id = $1 AND t.removed_at IS NULL) AS transactions,
       (SELECT MAX(bs.as_of) FROM balance_snapshots bs
        JOIN accounts a ON a.id = bs.account_id
        WHERE a.household_id = $1) AS latest_balance`,
    [householdId],
  );
  return {
    accounts: Number(rows[0]?.accounts ?? 0),
    transactions: Number(rows[0]?.transactions ?? 0),
    latestBalanceAt: rows[0]?.latest_balance ?? null,
  };
}

export type SituationRow = {
  household_id: string;
  version: number;
  computed_at: Date;
  trigger_event_id: string | null;
  sync_attempt_id: string | null;
  liquid_cents: string | null;
  monthly_outflow_cents: string | null;
  monthly_inflow_cents: string | null;
  runway_months: string | null;
  debt_posture: Record<string, unknown>;
  income_shape: Record<string, unknown>;
  liquidity_map: Record<string, unknown>;
  recurring_commitments: Record<string, unknown>;
  duplicate_candidates: unknown[];
  meta: Record<string, unknown>;
};

export async function getLedgerForInterpret(
  pool: Db,
  householdId: string,
  windowDays: number,
) {
  const { rows: accountRows } = await pool.query<{
    account_id: string;
    name: string;
    type: string;
    subtype: string | null;
    mask: string | null;
    include_in_runway: boolean;
    current_cents: string | null;
    available_cents: string | null;
  }>(
    `SELECT DISTINCT ON (a.id)
       a.id AS account_id,
       a.name,
       a.type,
       a.subtype,
       a.mask,
       a.include_in_runway,
       bs.current_cents,
       bs.available_cents
     FROM accounts a
     LEFT JOIN balance_snapshots bs ON bs.account_id = a.id
     WHERE a.household_id = $1
     ORDER BY a.id, bs.as_of DESC NULLS LAST`,
    [householdId],
  );

  const { rows: txnRows } = await pool.query<{
    account_id: string;
    account_type: string;
    amount_cents: string;
    pending: boolean;
    payment_channel: string | null;
    raw_name: string | null;
  }>(
    `SELECT t.account_id, a.type AS account_type, t.amount_cents, t.pending, t.payment_channel, t.raw_name
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE a.household_id = $1
       AND t.removed_at IS NULL
       AND t.posted_date >= CURRENT_DATE - ($2::int * INTERVAL '1 day')`,
    [householdId, windowDays],
  );

  return {
    accounts: accountRows.map((r) => ({
      accountId: r.account_id,
      name: r.name,
      type: r.type,
      subtype: r.subtype,
      mask: r.mask,
      includeInRunway: r.include_in_runway,
      currentCents: r.current_cents !== null ? Number(r.current_cents) : null,
      availableCents: r.available_cents !== null ? Number(r.available_cents) : null,
    })),
    transactions: txnRows.map((r) => ({
      accountId: r.account_id,
      accountType: r.account_type,
      amountCents: Number(r.amount_cents),
      pending: r.pending,
      paymentChannel: r.payment_channel,
      rawName: r.raw_name,
    })),
  };
}

export async function upsertSituation(
  pool: Db,
  row: {
    householdId: string;
    version: number;
    computedAt: string;
    triggerEventId: string;
    syncAttemptId: string | null;
    liquidCents: number;
    monthlyOutflowCents: number;
    monthlyInflowCents: number;
    runwayMonths: number | null;
    debtPosture: Record<string, unknown>;
    incomeShape: Record<string, unknown>;
    liquidityMap: Record<string, unknown>;
    recurringCommitments: Record<string, unknown>;
    duplicateCandidates: unknown[];
    meta: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO situations (
       household_id, version, computed_at, trigger_event_id, sync_attempt_id,
       liquid_cents, monthly_outflow_cents, monthly_inflow_cents, runway_months,
       debt_posture, income_shape, liquidity_map, recurring_commitments,
       duplicate_candidates, meta
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (household_id) DO UPDATE SET
       version = EXCLUDED.version,
       computed_at = EXCLUDED.computed_at,
       trigger_event_id = EXCLUDED.trigger_event_id,
       sync_attempt_id = EXCLUDED.sync_attempt_id,
       liquid_cents = EXCLUDED.liquid_cents,
       monthly_outflow_cents = EXCLUDED.monthly_outflow_cents,
       monthly_inflow_cents = EXCLUDED.monthly_inflow_cents,
       runway_months = EXCLUDED.runway_months,
       debt_posture = EXCLUDED.debt_posture,
       income_shape = EXCLUDED.income_shape,
       liquidity_map = EXCLUDED.liquidity_map,
       recurring_commitments = EXCLUDED.recurring_commitments,
       duplicate_candidates = EXCLUDED.duplicate_candidates,
       meta = EXCLUDED.meta,
       updated_at = now()`,
    [
      row.householdId,
      row.version,
      row.computedAt,
      row.triggerEventId,
      row.syncAttemptId,
      row.liquidCents,
      row.monthlyOutflowCents,
      row.monthlyInflowCents,
      row.runwayMonths,
      JSON.stringify(row.debtPosture),
      JSON.stringify(row.incomeShape),
      JSON.stringify(row.liquidityMap),
      JSON.stringify(row.recurringCommitments),
      JSON.stringify(row.duplicateCandidates),
      JSON.stringify(row.meta),
    ],
  );
}

export async function getSituation(pool: Db, householdId: string): Promise<SituationRow | null> {
  const { rows } = await pool.query<SituationRow>(
    `SELECT * FROM situations WHERE household_id = $1`,
    [householdId],
  );
  return rows[0] ?? null;
}
