import { z } from "zod";

const ConfigSchema = z.object({
  databaseUrl: z.string().min(1),
  pennyApiUrl: z.string().url().default("http://localhost:3001"),
  smsPort: z.coerce.number().int().positive().default(3002),
  openAiApiKey: z.string().optional(),
  openAiModel: z.string().default("gpt-4o-mini"),
  openAiBaseUrl: z.string().url().optional(),
  logLevel: z.string().default("info"),
  devMode: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  devHouseholdId: z.string().uuid().optional(),
  devPersonId: z.string().uuid().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return ConfigSchema.parse({
    databaseUrl: env.DATABASE_URL,
    pennyApiUrl: env.PENNY_API_URL ?? "http://localhost:3001",
    smsPort: env.SMS_PORT ?? "3002",
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL ?? "gpt-4o-mini",
    openAiBaseUrl: env.OPENAI_BASE_URL,
    logLevel: env.LOG_LEVEL ?? "info",
    devMode: env.SMS_DEV_MODE,
    devHouseholdId: env.PENNY_DEV_HOUSEHOLD_ID,
    devPersonId: env.PENNY_DEV_PERSON_ID,
  });
}
