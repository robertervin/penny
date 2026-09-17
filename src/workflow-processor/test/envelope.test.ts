import { describe, expect, it } from "vitest";
import { parseSqsBody } from "@penny/core";

describe("parseSqsBody", () => {
  it("parses a bare Penny envelope", () => {
    const envelope = parseSqsBody(
      JSON.stringify({
        source: "penny.plaid",
        detailType: "PlaidSyncRequested",
        schemaVersion: 1,
        eventId: "550e8400-e29b-41d4-a716-446655440000",
        detail: {
          schema_version: 1,
          event_id: "550e8400-e29b-41d4-a716-446655440000",
          household_id: "660e8400-e29b-41d4-a716-446655440001",
        },
      }),
    );

    expect(envelope.source).toBe("penny.plaid");
    expect(envelope.detailType).toBe("PlaidSyncRequested");
    expect(envelope.detail.household_id).toBe("660e8400-e29b-41d4-a716-446655440001");
  });

  it("parses an EventBridge-wrapped envelope", () => {
    const envelope = parseSqsBody(
      JSON.stringify({
        source: "penny.plaid",
        "detail-type": "PlaidSyncRequested",
        detail: {
          schema_version: 1,
          event_id: "550e8400-e29b-41d4-a716-446655440000",
          household_id: "660e8400-e29b-41d4-a716-446655440001",
        },
      }),
    );

    expect(envelope.source).toBe("penny.plaid");
    expect(envelope.detailType).toBe("PlaidSyncRequested");
    expect(envelope.eventId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid envelopes", () => {
    expect(() => parseSqsBody(JSON.stringify({ foo: "bar" }))).toThrow();
  });
});
