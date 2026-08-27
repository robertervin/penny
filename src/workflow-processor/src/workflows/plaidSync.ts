import { randomUUID } from "node:crypto";
import {
  type Config,
  type AwsClients,
  type Db,
  type Logger,
  type TokenVault,
  type PlaidGateway,
  putPennyEvent,
  putSnapshotObject,
  getPlaidItemForUpdate,
  insertSyncAttempt,
  markItemNeedsReauth,
  DETAIL_PLAID_SNAPSHOT_READY,
  PermanentWorkflowError,
  PlaidSyncRequestedDetailSchema,
  SOURCE_PLAID,
  type EventEnvelope,
  type PlaidSyncRequestedDetail,
} from "@penny/core";
import type { PlaidSyncSnapshot } from "./snapshot.js";
import type { Workflow, WorkflowContext } from "./types.js";

type SyncDeps = {
  config: Config;
  pool: Db;
  clients: AwsClients;
  plaid: PlaidGateway;
  tokens: TokenVault;
  log: Logger;
};

async function publishSnapshotReady(
  deps: SyncDeps,
  opts: {
    detail: PlaidSyncRequestedDetail;
    syncAttemptId: string;
    payloadKey: string;
    cursorBefore: string | null;
    cursorAfter: string;
    itemId: string;
    personId: string;
    householdId: string;
    fetchedAt: string;
  },
): Promise<void> {
  await putPennyEvent({
    clients: deps.clients,
    busName: deps.config.eventBusName,
    source: SOURCE_PLAID,
    detailType: DETAIL_PLAID_SNAPSHOT_READY,
    detail: {
      schema_version: 1,
      event_id: randomUUID(),
      correlation_id: opts.detail.correlation_id ?? opts.detail.event_id,
      person_id: opts.personId,
      household_id: opts.householdId,
      plaid_item_id: opts.itemId,
      account_id: opts.detail.account_id ?? null,
      sync_attempt_id: opts.syncAttemptId,
      fetched_at: opts.fetchedAt,
      sync_mode: opts.detail.mode,
      payload_ref: { store: "s3", key: opts.payloadKey },
      cursor: {
        transactions_cursor_before: opts.cursorBefore,
        transactions_cursor_after: opts.cursorAfter,
        cursor_committed: false,
      },
    },
  });
}

export function createPlaidSyncWorkflow(deps: SyncDeps): Workflow {
  return {
    name: "plaid-sync",
    source: SOURCE_PLAID,
    detailType: "PlaidSyncRequested",
    schemaVersion: 1,
    async handle(envelope: EventEnvelope, ctx: WorkflowContext): Promise<void> {
      const detail = PlaidSyncRequestedDetailSchema.parse(envelope.detail);

      // If a prior attempt fetched Plaid but failed while publishing, republish.
      const existing = await deps.pool.query<{
        id: string;
        status: string;
        payload_ref: string;
        cursor_before: string | null;
        cursor_after: string;
        plaid_item_id: string;
      }>(
        `SELECT id, status, payload_ref, cursor_before, cursor_after, plaid_item_id
         FROM sync_attempts WHERE event_id = $1`,
        [detail.event_id],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.status === "committed") {
          deps.log.info({ eventId: detail.event_id }, "sync already committed; noop");
          return;
        }
        await publishSnapshotReady(deps, {
          detail,
          syncAttemptId: row.id,
          payloadKey: row.payload_ref,
          cursorBefore: row.cursor_before,
          cursorAfter: row.cursor_after,
          itemId: row.plaid_item_id,
          personId: detail.person_id,
          householdId: detail.household_id,
          fetchedAt: new Date().toISOString(),
        });
        deps.log.info({ syncAttemptId: row.id }, "republished snapshot.ready after prior fetch");
        return;
      }

      const client = await deps.pool.connect();
      try {
        await client.query("BEGIN");
        const item = await getPlaidItemForUpdate(client, detail.plaid_item_id);
        if (!item) {
          throw new PermanentWorkflowError(`Unknown plaid_item_id ${detail.plaid_item_id}`);
        }
        if (item.status === "needs_reauth" || item.status === "unlinked") {
          throw new PermanentWorkflowError(`Item ${item.id} status=${item.status}; skip sync`);
        }
        if (item.household_id !== detail.household_id || item.person_id !== detail.person_id) {
          throw new PermanentWorkflowError("person/household does not own plaid item");
        }

        let accessToken: string;
        try {
          accessToken = deps.tokens.decrypt(item.access_token_encrypted);
        } catch {
          throw new PermanentWorkflowError("Failed to decrypt access token");
        }

        const cursorBefore = item.txn_cursor;
        let sync;
        try {
          sync = await deps.plaid.syncTransactions(accessToken, cursorBefore);
        } catch (err) {
          if (
            err instanceof PermanentWorkflowError &&
            err.message.includes("ITEM_LOGIN_REQUIRED")
          ) {
            await markItemNeedsReauth(client, item.id, "ITEM_LOGIN_REQUIRED");
            await client.query("COMMIT");
            throw err;
          }
          await client.query("ROLLBACK");
          throw err;
        }

        const balances = await deps.plaid.getBalances(accessToken);
        const fetchedAt = new Date().toISOString();
        const syncAttemptId = randomUUID();
        const payloadKey = `snapshots/${item.id}/${syncAttemptId}.json`;

        const accountMap = new Map(balances.map((a) => [a.account_id, a]));
        for (const txn of [...sync.added, ...sync.modified]) {
          if (!accountMap.has(txn.account_id)) {
            accountMap.set(txn.account_id, {
              account_id: txn.account_id,
              name: "Unknown",
              official_name: null,
              mask: null,
              type: "other",
              subtype: null,
              balances: {
                available: null,
                current: null,
                limit: null,
                iso_currency_code: "USD",
              },
            });
          }
        }

        const accountIds = [...accountMap.keys()];
        const snapshot: PlaidSyncSnapshot = {
          schema_version: 1,
          sync_attempt_id: syncAttemptId,
          plaid_item_id: item.id,
          household_id: item.household_id,
          person_id: item.person_id,
          fetched_at: fetchedAt,
          sync_mode: detail.mode,
          cursor_before: cursorBefore,
          cursor_after: sync.next_cursor,
          plaid_request_ids: sync.request_id ? [sync.request_id] : [],
          accounts: accountIds.map((accountId) => {
            const account = accountMap.get(accountId)!;
            return {
              account,
              transactions: {
                added: sync.added.filter((t) => t.account_id === accountId),
                modified: sync.modified.filter((t) => t.account_id === accountId),
                removed: [],
              },
            };
          }),
        };

        if (snapshot.accounts[0]) {
          snapshot.accounts[0].transactions.removed = sync.removed;
        } else if (sync.removed.length > 0) {
          snapshot.accounts.push({
            account: {
              account_id: "_removed",
              name: "_removed",
              official_name: null,
              mask: null,
              type: "other",
              subtype: null,
              balances: {
                available: null,
                current: null,
                limit: null,
                iso_currency_code: "USD",
              },
            },
            transactions: { added: [], modified: [], removed: sync.removed },
          });
        }

        await putSnapshotObject({
          clients: deps.clients,
          bucket: deps.config.payloadBucket,
          key: payloadKey,
          body: snapshot,
        });

        await insertSyncAttempt(client, {
          id: syncAttemptId,
          plaidItemId: item.id,
          eventId: detail.event_id,
          correlationId: detail.correlation_id,
          cursorBefore,
          cursorAfter: sync.next_cursor,
          payloadRef: payloadKey,
          accountsExpected: snapshot.accounts.filter((a) => a.account.account_id !== "_removed")
            .length,
        });

        await client.query("COMMIT");

        await publishSnapshotReady(deps, {
          detail,
          syncAttemptId,
          payloadKey,
          cursorBefore,
          cursorAfter: sync.next_cursor,
          itemId: item.id,
          personId: item.person_id,
          householdId: item.household_id,
          fetchedAt,
        });

        deps.log.info(
          {
            plaidItemId: item.id,
            syncAttemptId,
            added: sync.added.length,
            modified: sync.modified.length,
            removed: sync.removed.length,
            correlationId: ctx.correlationId,
          },
          "plaid sync published snapshot",
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
