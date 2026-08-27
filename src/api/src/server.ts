import { serve } from "@hono/node-server";
import { type Config, createLogger, createPool, runMigrations } from "@penny/core";
import { createApp } from "./app.js";

export { createApp } from "./app.js";

export async function startApiServer(config: Config) {
  const log = createLogger(config.logLevel, "penny-api");
  const pool = createPool(config.databaseUrl);
  await runMigrations(pool);

  const app = createApp({ config, pool, log });
  const port = config.apiPort;

  serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
    log.info({ port, cors: config.corsOrigins }, "penny plaid api listening");
  });
}
