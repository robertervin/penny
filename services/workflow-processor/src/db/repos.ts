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
