import type { Message } from "@aws-sdk/client-sqs";
import { ZodError } from "zod";
import type { Config } from "../config/env.js";
import type { AwsClients } from "../aws/clients.js";
import { deleteMessage, receiveWorkflowMessages } from "../aws/clients.js";
import type { Db } from "../db/pool.js";
import { tryMarkEventProcessed } from "../db/repos.js";
import {
  isPermanentError,
  parseSqsBody,
  PermanentWorkflowError,
} from "../events/envelope.js";
import type { Logger } from "../logger.js";
import type { WorkflowRouter } from "../workflows/router.js";

export class WorkflowProcessor {
  private running = false;

  constructor(
    private readonly deps: {
      config: Config;
      pool: Db;
      clients: AwsClients;
      router: WorkflowRouter;
      log: Logger;
    },
  ) {}

  async start(): Promise<void> {
    this.running = true;
    this.deps.log.info(
      { queue: this.deps.config.workflowQueueUrl, concurrency: this.deps.config.workerConcurrency },
      "workflow processor starting",
    );

    const workers = Array.from({ length: this.deps.config.workerConcurrency }, (_, i) =>
      this.loop(i),
    );
    await Promise.all(workers);
  }

  stop(): void {
    this.running = false;
  }

  private async loop(workerId: number): Promise<void> {
    while (this.running) {
      try {
        const messages = await receiveWorkflowMessages({
          clients: this.deps.clients,
          queueUrl: this.deps.config.workflowQueueUrl,
          maxMessages: 1,
          waitTimeSeconds: 20,
        });
        if (messages.length === 0) continue;
        for (const message of messages) {
          await this.handleMessage(message, workerId);
        }
      } catch (err) {
        this.deps.log.error({ err, workerId }, "poll loop error");
        await sleep(1000);
      }
    }
  }

  /** Exposed for tests. */
  async handleMessage(message: Message, workerId = 0): Promise<"deleted" | "left"> {
    const body = message.Body;
    if (!body || !message.ReceiptHandle) {
      this.deps.log.warn({ workerId }, "empty SQS message");
      return "left";
    }

    let envelope;
    try {
      envelope = parseSqsBody(body);
    } catch (err) {
      this.deps.log.error({ err, workerId }, "unparseable message; deleting");
      await deleteMessage({
        clients: this.deps.clients,
        queueUrl: this.deps.config.workflowQueueUrl,
        receiptHandle: message.ReceiptHandle,
      });
      return "deleted";
    }

    const claimed = await tryMarkEventProcessed(
      this.deps.pool,
      envelope.eventId,
      envelope.source,
      envelope.detailType,
    );
    if (!claimed) {
      this.deps.log.info({ eventId: envelope.eventId }, "duplicate event; deleting");
      await deleteMessage({
        clients: this.deps.clients,
        queueUrl: this.deps.config.workflowQueueUrl,
        receiptHandle: message.ReceiptHandle,
      });
      return "deleted";
    }

    try {
      await withTimeout(
        this.deps.router.dispatch(envelope, {
          correlationId: envelope.correlationId,
          receiptHandle: message.ReceiptHandle,
        }),
        this.deps.config.workflowTimeoutMs,
      );
      await deleteMessage({
        clients: this.deps.clients,
        queueUrl: this.deps.config.workflowQueueUrl,
        receiptHandle: message.ReceiptHandle,
      });
      return "deleted";
    } catch (err) {
      if (err instanceof ZodError) {
        this.deps.log.error({ err: err.flatten(), eventId: envelope.eventId }, "invalid detail; deleting");
        await deleteMessage({
          clients: this.deps.clients,
          queueUrl: this.deps.config.workflowQueueUrl,
          receiptHandle: message.ReceiptHandle,
        });
        return "deleted";
      }
      if (isPermanentError(err) || err instanceof PermanentWorkflowError) {
        this.deps.log.error({ err, eventId: envelope.eventId }, "permanent workflow failure; deleting");
        await deleteMessage({
          clients: this.deps.clients,
          queueUrl: this.deps.config.workflowQueueUrl,
          receiptHandle: message.ReceiptHandle,
        });
        return "deleted";
      }
      // Retryable: leave message for visibility timeout. Remove processed_events so retry can run.
      await this.deps.pool.query(`DELETE FROM processed_events WHERE event_id = $1`, [
        envelope.eventId,
      ]);
      this.deps.log.error({ err, eventId: envelope.eventId }, "retryable workflow failure; leaving message");
      return "left";
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`workflow timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
