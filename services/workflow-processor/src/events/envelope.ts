import { z } from "zod";

export const SOURCE_PLAID = "penny.plaid" as const;

export const DETAIL_PLAID_SYNC_REQUESTED = "PlaidSyncRequested" as const;
export const DETAIL_PLAID_SNAPSHOT_READY = "PlaidSnapshotReady" as const;

export const EventEnvelopeSchema = z.object({
  source: z.string().min(1),
  detailType: z.string().min(1),
  schemaVersion: z.number().int().positive(),
  eventId: z.string().uuid(),
  correlationId: z.string().uuid().optional(),
  detail: z.record(z.unknown()),
  raw: z.unknown().optional(),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

export const PlaidSyncRequestedDetailSchema = z.object({
  schema_version: z.literal(1),
  event_id: z.string().uuid(),
  correlation_id: z.string().uuid().optional(),
  person_id: z.string().uuid(),
  household_id: z.string().uuid(),
  plaid_item_id: z.string().uuid(),
  account_id: z.string().uuid().nullable().optional(),
  mode: z.enum(["incremental", "initial_backfill"]).default("incremental"),
  reason: z.enum(["link", "webhook", "manual", "scheduled", "smoke"]).default("manual"),
});

export type PlaidSyncRequestedDetail = z.infer<typeof PlaidSyncRequestedDetailSchema>;

export const PlaidSnapshotReadyDetailSchema = z.object({
  schema_version: z.literal(1),
  event_id: z.string().uuid(),
  correlation_id: z.string().uuid().optional(),
  person_id: z.string().uuid(),
  household_id: z.string().uuid(),
  plaid_item_id: z.string().uuid(),
  account_id: z.string().uuid().nullable().optional(),
  sync_attempt_id: z.string().uuid(),
  fetched_at: z.string(),
  sync_mode: z.enum(["incremental", "initial_backfill"]),
  payload_ref: z.object({
    store: z.enum(["s3", "postgres"]),
    key: z.string().min(1),
  }),
  cursor: z.object({
    transactions_cursor_before: z.string().nullable(),
    transactions_cursor_after: z.string(),
    cursor_committed: z.boolean(),
  }),
});

export type PlaidSnapshotReadyDetail = z.infer<typeof PlaidSnapshotReadyDetailSchema>;

/**
 * Parse an SQS body that wraps an EventBridge event (or a bare Penny envelope for tests).
 */
export function parseSqsBody(body: string): EventEnvelope {
  const parsed: unknown = JSON.parse(body);

  // EventBridge → SQS target wraps the event as the message body.
  if (isEventBridgeEvent(parsed)) {
    const detail =
      typeof parsed.detail === "string" ? JSON.parse(parsed.detail) : parsed.detail;
    return EventEnvelopeSchema.parse({
      source: parsed.source,
      detailType: parsed["detail-type"],
      schemaVersion: Number(detail.schema_version ?? 1),
      eventId: String(detail.event_id),
      correlationId: detail.correlation_id ? String(detail.correlation_id) : undefined,
      detail: detail as Record<string, unknown>,
      raw: parsed,
    });
  }

  // Bare envelope (tests / direct publish helpers).
  if (isBareEnvelope(parsed)) {
    return EventEnvelopeSchema.parse({
      source: parsed.source,
      detailType: parsed.detailType ?? parsed["detail-type"],
      schemaVersion: Number(parsed.schemaVersion ?? parsed.detail?.schema_version ?? 1),
      eventId: String(parsed.eventId ?? parsed.detail?.event_id),
      correlationId: parsed.correlationId ?? parsed.detail?.correlation_id,
      detail: (parsed.detail ?? {}) as Record<string, unknown>,
      raw: parsed,
    });
  }

  throw new PermanentWorkflowError("Unrecognized SQS message shape");
}

function isEventBridgeEvent(value: unknown): value is {
  source: string;
  "detail-type": string;
  detail: unknown;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    "detail-type" in value &&
    "detail" in value
  );
}

function isBareEnvelope(value: unknown): value is {
  source: string;
  detailType?: string;
  "detail-type"?: string;
  schemaVersion?: number;
  eventId?: string;
  correlationId?: string;
  detail?: Record<string, unknown>;
} {
  return typeof value === "object" && value !== null && "source" in value;
}

export class PermanentWorkflowError extends Error {
  readonly permanent = true as const;
  constructor(message: string) {
    super(message);
    this.name = "PermanentWorkflowError";
  }
}

export class RetryableWorkflowError extends Error {
  readonly permanent = false as const;
  constructor(message: string) {
    super(message);
    this.name = "RetryableWorkflowError";
  }
}

export function isPermanentError(err: unknown): boolean {
  return err instanceof PermanentWorkflowError || (err as { permanent?: boolean })?.permanent === true;
}
