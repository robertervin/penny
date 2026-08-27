// Config
export { loadConfig, type Config } from "./config/env.js";

// Database
export { createPool, runMigrations, type Db } from "./db/pool.js";
export * from "./db/repos.js";
export * from "./db/memoryRepos.js";
export * from "./db/channelRepos.js";

// Events
export * from "./events/envelope.js";
export { publishPlaidSyncRequested } from "./events/publishSync.js";
export { publishHouseholdInterpretRequested } from "./events/publishInterpret.js";

// AWS
export { createAwsClients, putPennyEvent, putSnapshotObject, getSnapshotObject, receiveWorkflowMessages, deleteMessage, type AwsClients } from "./aws/clients.js";

// Crypto
export { TokenVault } from "./crypto/tokenVault.js";

// Plaid
export { createPlaidApi } from "./plaid/client.js";
export { createPlaidGateway, type PlaidGateway, type PlaidAccountSnapshot, type PlaidTxn } from "./plaid/gateway.js";

// Interpret
export * from "./interpret/classifyTransaction.js";
export * from "./interpret/computeSituation.js";
export * from "./interpret/breakdown.js";
export { computeSituationForHousehold, INTERPRET_WINDOW_DAYS } from "./interpret/computeForHousehold.js";
export {
  getSituationBreakdownForHousehold,
  VALID_BREAKDOWN_BUCKETS,
} from "./interpret/situationQuery.js";

// Logger
export { createLogger, type Logger } from "./logger.js";
