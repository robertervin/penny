import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Config, Db, Logger } from "@penny/core";
import { createApiServices } from "./composition/container.js";
import { createHealthRoutes } from "./routes/health.js";
import { createSessionRoutes } from "./routes/session.js";
import { createPlaidRoutes } from "./routes/plaid.js";
import { createHouseholdRoutes } from "./routes/household.js";
import { createSituationRoutes } from "./routes/situation.js";
import { createMemoryRoutes } from "./routes/memory.js";
import { createInterpretRoutes } from "./routes/interpret.js";

export function createApp(deps: { config: Config; pool: Db; log: Logger }) {
  const app = new Hono();
  const origins = deps.config.corsOrigins.split(",").map((s) => s.trim());
  app.use("*", cors({ origin: origins, credentials: true }));

  const services = createApiServices(deps);

  for (const mount of [
    createHealthRoutes(),
    createSessionRoutes(services),
    createPlaidRoutes(services),
    createHouseholdRoutes(services),
    createSituationRoutes(services),
    createMemoryRoutes(services),
    createInterpretRoutes(services),
  ]) {
    app.route("/", mount);
  }

  return app;
}
