import { describe, expect, it } from "vitest";
import {
  PermanentWorkflowError,
  parseSqsBody,
} from "../src/events/envelope.js";
import { WorkflowRouter } from "../src/workflows/router.js";
import { createLogger } from "../src/logger.js";
import type { Workflow } from "../src/workflows/types.js";
import { dollarsToCents, plaidAmountToCents } from "../src/workflows/snapshot.js";
import { TokenVault } from "../src/crypto/tokenVault.js";

describe("parseSqsBody", () => {
  it("parses EventBridge → SQS wrapper", () => {
    const eventId = "11111111-1111-4111-8111-111111111111";
    const body = JSON.stringify({
      source: "penny.plaid",
      "detail-type": "PlaidSyncRequested",
      detail: {
        schema_version: 1,
        event_id: eventId,
        person_id: "22222222-2222-4222-8222-222222222222",
      },
    });
    const env = parseSqsBody(body);
    expect(env.source).toBe("penny.plaid");
    expect(env.detailType).toBe("PlaidSyncRequested");
    expect(env.eventId).toBe(eventId);
    expect(env.schemaVersion).toBe(1);
  });

  it("parses detail when EventBridge stringifies it", () => {
    const eventId = "11111111-1111-4111-8111-111111111111";
    const body = JSON.stringify({
      source: "penny.plaid",
      "detail-type": "PlaidSnapshotReady",
      detail: JSON.stringify({
        schema_version: 1,
        event_id: eventId,
      }),
    });
    const env = parseSqsBody(body);
    expect(env.detailType).toBe("PlaidSnapshotReady");
    expect(env.eventId).toBe(eventId);
  });

  it("rejects unknown shapes permanently", () => {
    expect(() => parseSqsBody(JSON.stringify({ foo: 1 }))).toThrow(PermanentWorkflowError);
  });
});

describe("WorkflowRouter", () => {
  const log = createLogger("silent");

  it("dispatches to matching workflow", async () => {
    let called = false;
    const wf: Workflow = {
      name: "test",
      source: "penny.plaid",
      detailType: "PlaidSyncRequested",
      schemaVersion: 1,
      handle: async () => {
        called = true;
      },
    };
    const router = new WorkflowRouter([wf], log);
    await router.dispatch(
      {
        source: "penny.plaid",
        detailType: "PlaidSyncRequested",
        schemaVersion: 1,
        eventId: "11111111-1111-4111-8111-111111111111",
        detail: {},
      },
      {},
    );
    expect(called).toBe(true);
  });

  it("marks unknown types permanent", async () => {
    const router = new WorkflowRouter([], log);
    await expect(
      router.dispatch(
        {
          source: "penny.unknown",
          detailType: "Nope",
          schemaVersion: 1,
          eventId: "11111111-1111-4111-8111-111111111111",
          detail: {},
        },
        {},
      ),
    ).rejects.toBeInstanceOf(PermanentWorkflowError);
  });
});

describe("money helpers", () => {
  it("converts dollars to cents", () => {
    expect(dollarsToCents(12.34)).toBe(1234);
    expect(dollarsToCents(null)).toBeNull();
    expect(plaidAmountToCents(-2500)).toBe(-250000);
  });
});

describe("TokenVault", () => {
  it("round-trips access tokens", () => {
    const vault = new TokenVault("test-secret");
    const enc = vault.encrypt("access-sandbox-xyz");
    expect(enc.startsWith("v1:")).toBe(true);
    expect(vault.decrypt(enc)).toBe("access-sandbox-xyz");
  });
});
