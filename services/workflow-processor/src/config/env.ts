import { z } from "zod";

const boolFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const ConfigSchema = z.object({
  awsRegion: z.string().default("us-east-1"),
  awsEndpointUrl: z.string().optional(),
  eventBusName: z.string().default("penny"),
  workflowQueueUrl: z.string().min(1),
  payloadBucket: z.string().default("penny-plaid-snapshots"),
  databaseUrl: z.string().min(1),
  plaidClientId: z.string().optional(),
  plaidSecret: z.string().optional(),
  plaidEnv: z.enum(["sandbox", "development", "production"]).default("sandbox"),
  /** When true, Plaid HTTP is stubbed (tests / no credentials). */
  plaidStub: z.boolean().default(false),
  /** Local-only: access tokens stored as plaintext with this prefix. */
  tokenEncryptionKey: z.string().default("local-dev-only-not-for-prod"),
  workerConcurrency: z.coerce.number().int().positive().default(4),
  workflowTimeoutMs: z.coerce.number().int().positive().default(270_000),
  logLevel: z.string().default("info"),
  apiPort: z.coerce.number().int().positive().default(3001),
  corsOrigins: z.string().default("http://localhost:5174,http://127.0.0.1:5174"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = ConfigSchema.safeParse({
    awsRegion: env.AWS_REGION ?? "us-east-1",
    awsEndpointUrl: env.AWS_ENDPOINT_URL || undefined,
    eventBusName: env.EVENT_BUS_NAME ?? "penny",
    workflowQueueUrl: env.WORKFLOW_QUEUE_URL,
    payloadBucket: env.PAYLOAD_BUCKET ?? "penny-plaid-snapshots",
    databaseUrl: env.DATABASE_URL,
    plaidClientId: env.PLAID_CLIENT_ID || undefined,
    plaidSecret: env.PLAID_SECRET || undefined,
    plaidEnv: env.PLAID_ENV ?? "sandbox",
    plaidStub: boolFromEnv(env.PLAID_STUB, !env.PLAID_CLIENT_ID),
    tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY ?? "local-dev-only-not-for-prod",
    workerConcurrency: env.WORKER_CONCURRENCY ?? "4",
    workflowTimeoutMs: env.WORKFLOW_TIMEOUT_MS ?? "270000",
    logLevel: env.LOG_LEVEL ?? "info",
    apiPort: env.API_PORT ?? "3001",
    corsOrigins: env.CORS_ORIGINS ?? "http://localhost:5174,http://127.0.0.1:5174",
  });

  if (!parsed.success) {
    throw new Error(`Invalid config: ${parsed.error.message}`);
  }
  return parsed.data;
}
