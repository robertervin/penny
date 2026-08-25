import type { Config } from "../config/env.js";
import type { AwsClients } from "../aws/clients.js";
import { getSnapshotObject } from "../aws/clients.js";
import type { Db } from "../db/pool.js";
import {
  getPlaidItemForUpdate,
  getSyncAttempt,
  insertBalanceSnapshot,
  markSyncAttemptCommitted,
  softDeleteTransaction,
  updateItemCursor,
  upsertAccount,
  upsertTransaction,
} from "../db/repos.js";
import {
  PermanentWorkflowError,
  PlaidSnapshotReadyDetailSchema,
  SOURCE_PLAID,
  type EventEnvelope,
} from "../events/envelope.js";
import type { Logger } from "../logger.js";
import { dollarsToCents, plaidAmountToCents, type PlaidSyncSnapshot } from "./snapshot.js";
import type { Workflow, WorkflowContext } from "./types.js";

export function createLedgerIngestWorkflow(deps: {
  config: Config;
  pool: Db;
  clients: AwsClients;
  log: Logger;
}): Workflow {
  return {
    name: "ledger-ingest",
    source: SOURCE_PLAID,
    detailType: "PlaidSnapshotReady",
    schemaVersion: 1,
    async handle(envelope: EventEnvelope, ctx: WorkflowContext): Promise<void> {
      const detail = PlaidSnapshotReadyDetailSchema.parse(envelope.detail);

      const attempt = await getSyncAttempt(deps.pool, detail.sync_attempt_id);
      if (!attempt) {
        throw new PermanentWorkflowError(`Unknown sync_attempt_id ${detail.sync_attempt_id}`);
      }
      if (attempt.status === "committed") {
        deps.log.info({ syncAttemptId: detail.sync_attempt_id }, "sync attempt already committed");
        return;
      }

      const snapshot = await getSnapshotObject<PlaidSyncSnapshot>({
        clients: deps.clients,
        bucket: deps.config.payloadBucket,
        key: detail.payload_ref.key,
      });

      if (snapshot.sync_attempt_id !== detail.sync_attempt_id) {
        throw new PermanentWorkflowError("Snapshot sync_attempt_id mismatch");
      }

      const client = await deps.pool.connect();
      try {
        await client.query("BEGIN");
        const item = await getPlaidItemForUpdate(client, detail.plaid_item_id);
        if (!item) {
          throw new PermanentWorkflowError(`Unknown plaid_item_id ${detail.plaid_item_id}`);
        }

        let accountsIngested = 0;
        const removedIds = new Set<string>();

        for (const slice of snapshot.accounts) {
          for (const r of slice.transactions.removed) {
            removedIds.add(r.transaction_id);
          }
        }

        for (const slice of snapshot.accounts) {
          if (slice.account.account_id === "_removed") continue;

          const accountId = await upsertAccount(client, {
            householdId: snapshot.household_id,
            plaidItemId: snapshot.plaid_item_id,
            plaidAccountId: slice.account.account_id,
            name: slice.account.name,
            officialName: slice.account.official_name,
            mask: slice.account.mask,
            type: slice.account.type,
            subtype: slice.account.subtype,
            isoCurrencyCode: slice.account.balances.iso_currency_code ?? "USD",
          });

          await insertBalanceSnapshot(client, {
            accountId,
            asOf: snapshot.fetched_at,
            availableCents: dollarsToCents(slice.account.balances.available),
            currentCents: dollarsToCents(slice.account.balances.current),
            limitCents: dollarsToCents(slice.account.balances.limit),
            isoCurrencyCode: slice.account.balances.iso_currency_code ?? "USD",
            syncAttemptId: snapshot.sync_attempt_id,
          });

          for (const txn of [...slice.transactions.added, ...slice.transactions.modified]) {
            await upsertTransaction(client, {
              accountId,
              plaidTransactionId: txn.transaction_id,
              amountCents: plaidAmountToCents(txn.amount),
              isoCurrencyCode: txn.iso_currency_code ?? "USD",
              postedDate: txn.date,
              datetime: txn.datetime,
              pending: txn.pending,
              pendingTransactionId: txn.pending_transaction_id,
              rawName: txn.name,
              merchantName: txn.merchant_name,
              paymentChannel: txn.payment_channel,
            });
          }

          accountsIngested += 1;
        }

        for (const transactionId of removedIds) {
          await softDeleteTransaction(client, transactionId);
        }

        await updateItemCursor(client, item.id, snapshot.cursor_after);
        await markSyncAttemptCommitted(client, snapshot.sync_attempt_id, accountsIngested);
        await client.query("COMMIT");

        deps.log.info(
          {
            syncAttemptId: snapshot.sync_attempt_id,
            accountsIngested,
            removed: removedIds.size,
            correlationId: ctx.correlationId,
          },
          "ledger ingest committed",
        );
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
