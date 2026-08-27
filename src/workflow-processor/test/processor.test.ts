import { describe, expect, it } from "vitest";
import { SOURCE_HOUSEHOLD, SOURCE_PLAID, DETAIL_PLAID_SYNC_REQUESTED } from "@penny/core";
import { WorkflowRouter } from "../src/workflows/router.js";
import { workflowKey } from "../src/workflows/types.js";

const log = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
  child: () => log,
};

describe("workflowKey", () => {
  it("builds a stable workflow key", () => {
    expect(workflowKey(SOURCE_PLAID, DETAIL_PLAID_SYNC_REQUESTED, 1)).toBe(
      "penny.plaid::PlaidSyncRequested::1",
    );
  });
});

describe("WorkflowRouter", () => {
  it("resolves a registered workflow", () => {
    const router = new WorkflowRouter(
      [
        {
          name: "plaid.sync",
          source: SOURCE_PLAID,
          detailType: DETAIL_PLAID_SYNC_REQUESTED,
          schemaVersion: 1,
          handle: async () => undefined,
        },
      ],
      log,
    );

    const workflow = router.resolve({
      source: SOURCE_PLAID,
      detailType: DETAIL_PLAID_SYNC_REQUESTED,
      schemaVersion: 1,
      eventId: "550e8400-e29b-41d4-a716-446655440000",
      detail: {},
    });

    expect(workflow.name).toBe("plaid.sync");
  });

  it("throws for unknown workflows", () => {
    const router = new WorkflowRouter([], log);

    expect(() =>
      router.resolve({
        source: SOURCE_HOUSEHOLD,
        detailType: "HouseholdInterpretRequested",
        schemaVersion: 1,
        eventId: "550e8400-e29b-41d4-a716-446655440000",
        detail: {},
      }),
    ).toThrow();
  });
});
