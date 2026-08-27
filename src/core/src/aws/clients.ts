import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from "@aws-sdk/client-sqs";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import type { Config } from "../config/env.js";

export type AwsClients = {
  sqs: SQSClient;
  events: EventBridgeClient;
  s3: S3Client;
};

export function createAwsClients(config: Config): AwsClients {
  const base = {
    region: config.awsRegion,
    ...(config.awsEndpointUrl
      ? {
          endpoint: config.awsEndpointUrl,
          forcePathStyle: true,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
          },
        }
      : {}),
  };

  return {
    sqs: new SQSClient(base),
    events: new EventBridgeClient(base),
    s3: new S3Client(base),
  };
}

export async function putPennyEvent(opts: {
  clients: AwsClients;
  busName: string;
  source: string;
  detailType: string;
  detail: Record<string, unknown>;
}): Promise<void> {
  const result = await opts.clients.events.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: opts.busName,
          Source: opts.source,
          DetailType: opts.detailType,
          Detail: JSON.stringify(opts.detail),
        },
      ],
    }),
  );

  const failure = result.Entries?.find((e) => e.ErrorCode);
  if (failure) {
    throw new Error(`PutEvents failed: ${failure.ErrorCode} ${failure.ErrorMessage}`);
  }
}

export async function receiveWorkflowMessages(opts: {
  clients: AwsClients;
  queueUrl: string;
  maxMessages?: number;
  waitTimeSeconds?: number;
}) {
  const res = await opts.clients.sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: opts.queueUrl,
      MaxNumberOfMessages: opts.maxMessages ?? 5,
      WaitTimeSeconds: opts.waitTimeSeconds ?? 20,
      VisibilityTimeout: 300,
      MessageAttributeNames: ["All"],
      AttributeNames: ["All"],
    }),
  );
  return res.Messages ?? [];
}

export async function deleteMessage(opts: {
  clients: AwsClients;
  queueUrl: string;
  receiptHandle: string;
}) {
  await opts.clients.sqs.send(
    new DeleteMessageCommand({
      QueueUrl: opts.queueUrl,
      ReceiptHandle: opts.receiptHandle,
    }),
  );
}

export async function extendVisibility(opts: {
  clients: AwsClients;
  queueUrl: string;
  receiptHandle: string;
  seconds: number;
}) {
  await opts.clients.sqs.send(
    new ChangeMessageVisibilityCommand({
      QueueUrl: opts.queueUrl,
      ReceiptHandle: opts.receiptHandle,
      VisibilityTimeout: opts.seconds,
    }),
  );
}

export async function putSnapshotObject(opts: {
  clients: AwsClients;
  bucket: string;
  key: string;
  body: unknown;
}): Promise<void> {
  await opts.clients.s3.send(
    new PutObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
      Body: JSON.stringify(opts.body),
      ContentType: "application/json",
    }),
  );
}

export async function getSnapshotObject<T>(opts: {
  clients: AwsClients;
  bucket: string;
  key: string;
}): Promise<T> {
  const res = await opts.clients.s3.send(
    new GetObjectCommand({
      Bucket: opts.bucket,
      Key: opts.key,
    }),
  );
  const text = await res.Body?.transformToString();
  if (!text) throw new Error(`Empty S3 object s3://${opts.bucket}/${opts.key}`);
  return JSON.parse(text) as T;
}
