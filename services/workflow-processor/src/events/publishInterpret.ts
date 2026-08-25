import { randomUUID } from "node:crypto";
import type { Config } from "../config/env.js";
import type { AwsClients } from "../aws/clients.js";
import { putPennyEvent } from "../aws/clients.js";
import {
  SOURCE_HOUSEHOLD,
  DETAIL_HOUSEHOLD_INTERPRET_REQUESTED,
} from "../events/envelope.js";

export async function publishHouseholdInterpretRequested(opts: {
  config: Config;
  clients: AwsClients;
  personId: string;
  householdId: string;
  trigger: "ledger_ingest" | "correction" | "manual";
  syncAttemptId?: string | null;
  correlationId?: string;
}): Promise<{ eventId: string }> {
  const eventId = randomUUID();
  await putPennyEvent({
    clients: opts.clients,
    busName: opts.config.eventBusName,
    source: SOURCE_HOUSEHOLD,
    detailType: DETAIL_HOUSEHOLD_INTERPRET_REQUESTED,
    detail: {
      schema_version: 1,
      event_id: eventId,
      correlation_id: opts.correlationId ?? eventId,
      person_id: opts.personId,
      household_id: opts.householdId,
      trigger: opts.trigger,
      sync_attempt_id: opts.syncAttemptId ?? null,
    },
  });
  return { eventId };
}
