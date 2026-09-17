import type { PlaidAccountSnapshot, PlaidTxn } from "@penny/core";

/** Normalized blob stored in S3 and consumed by ledger ingest. */
export type PlaidSyncSnapshot = {
  schema_version: 1;
  sync_attempt_id: string;
  plaid_item_id: string;
  household_id: string;
  person_id: string;
  fetched_at: string;
  sync_mode: "incremental" | "initial_backfill";
  cursor_before: string | null;
  cursor_after: string;
  plaid_request_ids: string[];
  accounts: Array<{
    account: PlaidAccountSnapshot;
    transactions: {
      added: PlaidTxn[];
      modified: PlaidTxn[];
      removed: Array<{ transaction_id: string }>;
    };
  }>;
  raw?: {
    note?: string;
  };
};

export function dollarsToCents(amount: number | null | undefined): number | null {
  if (amount === null || amount === undefined) return null;
  return Math.round(amount * 100);
}

/** Plaid amounts: positive = money leaving the account for depository. Store as cents. */
export function plaidAmountToCents(amount: number): number {
  return Math.round(amount * 100);
}
