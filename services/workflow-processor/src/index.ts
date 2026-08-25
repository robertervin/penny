import { loadConfig } from "./config/env.js";
import { createAwsClients } from "./aws/clients.js";
import { TokenVault } from "./crypto/tokenVault.js";
import { createPool, runMigrations } from "./db/pool.js";
import { createLogger } from "./logger.js";
import { createPlaidGateway } from "./plaid/gateway.js";
import { WorkflowProcessor } from "./processor/processor.js";
import { createLedgerIngestWorkflow } from "./workflows/ledgerIngest.js";
import { createPlaidSyncWorkflow } from "./workflows/plaidSync.js";
import { WorkflowRouter } from "./workflows/router.js";

async function main() {
  const config = loadConfig();
  const log = createLogger(config.logLevel);
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
