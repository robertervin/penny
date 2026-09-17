import {
  loadConfig,
  createAwsClients,
  TokenVault,
  createPool,
  runMigrations,
  createLogger,
  createPlaidGateway,
} from "@penny/core";
import { WorkflowProcessor } from "./processor/processor.js";
import { createLedgerIngestWorkflow } from "./workflows/ledgerIngest.js";
import { createInterpretWorkflow } from "./workflows/interpret.js";
import { createPlaidSyncWorkflow } from "./workflows/plaidSync.js";
import { WorkflowRouter } from "./workflows/router.js";

async function main() {
  const config = loadConfig();
  const log = createLogger(config.logLevel, "penny-workflow-processor");
  const pool = createPool(config.databaseUrl);
  const clients = createAwsClients(config);
  const tokens = new TokenVault(config.tokenEncryptionKey);
  const plaid = createPlaidGateway(config);

  await runMigrations(pool);
  log.info("migrations ok");

  const router = new WorkflowRouter(
    [
      createPlaidSyncWorkflow({ config, pool, clients, plaid, tokens, log }),
      createLedgerIngestWorkflow({ config, pool, clients, log }),
      createInterpretWorkflow({ config, pool, clients, log }),
    ],
    log,
  );

  const processor = new WorkflowProcessor({ config, pool, clients, router, log });

  const shutdown = async (signal: string) => {
    log.info({ signal }, "shutting down");
    processor.stop();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await processor.start();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
