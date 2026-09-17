import { randomUUID } from "node:crypto";
import type { Config } from "../config/env.js";
import type { AwsClients } from "../aws/clients.js";
import { putPennyEvent } from "../aws/clients.js";
import { SOURCE_PLAID, DETAIL_PLAID_SYNC_REQUESTED } from "../events/envelope.js";

export async function publishPlaidSyncRequested(opts: {
  config: Config;
  clients: AwsClients;
  personId: string;
  householdId: string;
  plaidItemId: string;
  mode?: "incremental" | "initial_backfill";
  reason?: "link" | "webhook" | "manual" | "scheduled";
}): Promise<{ eventId: string }> {
  const eventId = randomUUID();
  await putPennyEvent({
    clients: opts.clients,
    busName: opts.config.eventBusName,
    source: SOURCE_PLAID,
    detailType: DETAIL_PLAID_SYNC_REQUESTED,
    detail: {
      schema_version: 1,
      event_id: eventId,
      correlation_id: eventId,
      person_id: opts.personId,
      household_id: opts.householdId,
      plaid_item_id: opts.plaidItemId,
      mode: opts.mode ?? "initial_backfill",
      reason: opts.reason ?? "link",
    },
  });
  return { eventId };
}
