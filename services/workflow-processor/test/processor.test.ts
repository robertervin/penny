import { describe, expect, it, vi } from "vitest";
import { WorkflowProcessor } from "../src/processor/processor.js";
import { WorkflowRouter } from "../src/workflows/router.js";
import { createLogger } from "../src/logger.js";
import { PermanentWorkflowError, RetryableWorkflowError } from "../src/events/envelope.js";
import type { Workflow } from "../src/workflows/types.js";
import type { Config } from "../src/config/env.js";

const baseConfig = {
  awsRegion: "us-east-1",
  eventBusName: "penny",
  workflowQueueUrl: "http://localhost/queue",
  payloadBucket: "bucket",
  databaseUrl: "postgres://x",
  plaidStub: true,
  plaidEnv: "sandbox",
  tokenEncryptionKey: "k",
  workerConcurrency: 1,
  workflowTimeoutMs: 5_000,
  logLevel: "silent",
} as Config;

describe("WorkflowProcessor.handleMessage", () => {
  it("deletes permanent failures", async () => {
    const deletes: string[] = [];
    const clients = {
      sqs: {
        send: vi.fn(async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
          if (cmd.constructor.name === "DeleteMessageCommand") {
            deletes.push(String(cmd.input.ReceiptHandle));
          }
          return {};
        }),
      },
      events: { send: vi.fn() },
      s3: { send: vi.fn() },
    } as unknown as import("../src/aws/clients.js").AwsClients;

    const pool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO processed_events")) {
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      }),
    };

    const wf: Workflow = {
      name: "boom",
      source: "penny.plaid",
      detailType: "PlaidSyncRequested",
      schemaVersion: 1,
      handle: async () => {
        throw new PermanentWorkflowError("nope");
      },
    };

    const log = createLogger("silent");
    const processor = new WorkflowProcessor({
      config: baseConfig,
      pool: pool as never,
      clients,
      router: new WorkflowRouter([wf], log),
      log,
    });

    const eventId = "11111111-1111-4111-8111-111111111111";
    const result = await processor.handleMessage({
      Body: JSON.stringify({
        source: "penny.plaid",
        "detail-type": "PlaidSyncRequested",
        detail: { schema_version: 1, event_id: eventId },
      }),
      ReceiptHandle: "abc",
    });

    expect(result).toBe("deleted");
    expect(deletes).toContain("abc");
  });

  it("leaves retryable failures and clears processed_events", async () => {
    const deletes: string[] = [];
    const sqls: string[] = [];
    const clients = {
      sqs: {
        send: vi.fn(async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
          if (cmd.constructor.name === "DeleteMessageCommand") {
            deletes.push(String(cmd.input.ReceiptHandle));
          }
          return {};
        }),
      },
      events: { send: vi.fn() },
      s3: { send: vi.fn() },
    } as unknown as import("../src/aws/clients.js").AwsClients;

    const pool = {
      query: vi.fn(async (sql: string) => {
        sqls.push(sql);
        if (sql.includes("INSERT INTO processed_events")) {
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 0, rows: [] };
      }),
    };

    const wf: Workflow = {
      name: "retry",
      source: "penny.plaid",
      detailType: "PlaidSyncRequested",
      schemaVersion: 1,
      handle: async () => {
        throw new RetryableWorkflowError("later");
      },
    };

    const log = createLogger("silent");
    const processor = new WorkflowProcessor({
      config: baseConfig,
      pool: pool as never,
      clients,
      router: new WorkflowRouter([wf], log),
      log,
    });

    const eventId = "11111111-1111-4111-8111-111111111111";
    const result = await processor.handleMessage({
      Body: JSON.stringify({
        source: "penny.plaid",
        "detail-type": "PlaidSyncRequested",
        detail: { schema_version: 1, event_id: eventId },
      }),
      ReceiptHandle: "abc",
    });

    expect(result).toBe("left");
    expect(deletes).toHaveLength(0);
    expect(sqls.some((s) => s.includes("DELETE FROM processed_events"))).toBe(true);
  });
});
