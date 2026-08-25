import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { CountryCode, Products } from "plaid";
import type { Config } from "../config/env.js";
import { createAwsClients } from "../aws/clients.js";
import { TokenVault } from "../crypto/tokenVault.js";
import { createPool, runMigrations } from "../db/pool.js";
import {
  countLedgerForHousehold,
  getOrCreateLocalHousehold,
  getSituation,
  insertPlaidItem,
  listPlaidItemsForHousehold,
} from "../db/repos.js";
import { publishHouseholdInterpretRequested } from "../events/publishInterpret.js";
import { publishPlaidSyncRequested } from "../events/publishSync.js";
import { createLogger } from "../logger.js";
import { createPlaidApi } from "../plaid/client.js";

export function createApp(deps: {
  config: Config;
  pool: ReturnType<typeof createPool>;
  log: ReturnType<typeof createLogger>;
}) {
  const app = new Hono();
  const origins = deps.config.corsOrigins.split(",").map((s) => s.trim());
  app.use("*", cors({ origin: origins, credentials: true }));

  const vault = new TokenVault(deps.config.tokenEncryptionKey);
  const aws = createAwsClients(deps.config);

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.post("/api/session/bootstrap", async (c) => {
    const session = await getOrCreateLocalHousehold(deps.pool);
    return c.json(session);
  });

  app.post(
    "/api/plaid/link-token",
    zValidator(
      "json",
      z.object({
        person_id: z.string().uuid(),
        household_id: z.string().uuid(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json");
      const plaid = createPlaidApi(deps.config);
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: body.person_id },
      client_name: "Penny",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return c.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    });
    },
  );

  app.post(
    "/api/plaid/exchange",
    zValidator(
      "json",
      z.object({
        public_token: z.string().min(1),
        person_id: z.string().uuid(),
        household_id: z.string().uuid(),
        institution: z
          .object({
            institution_id: z.string().optional(),
            name: z.string().optional(),
          })
          .optional(),
      }),
    ),
    async (c) => {
      const body = c.req.valid("json");
      const plaid = createPlaidApi(deps.config);

      const exchange = await plaid.itemPublicTokenExchange({
        public_token: body.public_token,
      });
      const accessToken = exchange.data.access_token;
      const plaidItemExternalId = exchange.data.item_id;

      let institutionId = body.institution?.institution_id ?? null;
      let institutionName = body.institution?.name ?? null;
      try {
        const item = await plaid.itemGet({ access_token: accessToken });
        institutionId = item.data.item.institution_id ?? institutionId;
      } catch (err) {
        deps.log.warn({ err }, "itemGet failed after exchange");
      }

      const { itemId } = await insertPlaidItem(deps.pool, {
        householdId: body.household_id,
        personId: body.person_id,
        plaidItemExternalId,
        accessTokenEncrypted: vault.encrypt(accessToken),
        institutionId,
        institutionName,
      });

      const { eventId } = await publishPlaidSyncRequested({
        config: deps.config,
        clients: aws,
        personId: body.person_id,
        householdId: body.household_id,
        plaidItemId: itemId,
        mode: "initial_backfill",
        reason: "link",
      });

      deps.log.info(
        { itemId, plaidItemExternalId, eventId },
        "plaid item linked; sync requested",
      );

      return c.json({
        item_id: itemId,
        plaid_item_id: plaidItemExternalId,
        institution_id: institutionId,
        institution_name: institutionName,
        sync_event_id: eventId,
      });
    },
  );

  app.get("/api/household/:householdId/status", async (c) => {
    const householdId = c.req.param("householdId");
    const items = await listPlaidItemsForHousehold(deps.pool, householdId);
    const ledger = await countLedgerForHousehold(deps.pool, householdId);
    const situation = await getSituation(deps.pool, householdId);
    return c.json({
      items,
      ledger,
      situation: situation
        ? {
            version: situation.version,
            computedAt: situation.computed_at,
            runwayMonths: situation.runway_months !== null ? Number(situation.runway_months) : null,
            liquidCents: situation.liquid_cents !== null ? Number(situation.liquid_cents) : null,
            monthlyOutflowCents:
              situation.monthly_outflow_cents !== null
                ? Number(situation.monthly_outflow_cents)
                : null,
            monthlyInflowCents:
              situation.monthly_inflow_cents !== null ? Number(situation.monthly_inflow_cents) : null,
            debtPosture: situation.debt_posture,
            liquidityMap: situation.liquidity_map,
          }
        : null,
    });
  });

  app.get("/api/household/:householdId/situation", async (c) => {
    const householdId = c.req.param("householdId");
    const situation = await getSituation(deps.pool, householdId);
    if (!situation) {
      return c.json({ error: "Situation not computed yet" }, 404);
    }
    return c.json({
      householdId: situation.household_id,
      version: situation.version,
      computedAt: situation.computed_at,
      runwayMonths: situation.runway_months !== null ? Number(situation.runway_months) : null,
      liquidCents: situation.liquid_cents !== null ? Number(situation.liquid_cents) : null,
      monthlyOutflowCents:
        situation.monthly_outflow_cents !== null ? Number(situation.monthly_outflow_cents) : null,
      monthlyInflowCents:
        situation.monthly_inflow_cents !== null ? Number(situation.monthly_inflow_cents) : null,
      debtPosture: situation.debt_posture,
      incomeShape: situation.income_shape,
      liquidityMap: situation.liquidity_map,
      meta: situation.meta,
    });
  });

  app.post(
    "/api/household/:householdId/interpret",
    zValidator(
      "json",
      z.object({
        person_id: z.string().uuid(),
      }),
    ),
    async (c) => {
      const householdId = c.req.param("householdId");
      const body = c.req.valid("json");
      const { eventId } = await publishHouseholdInterpretRequested({
        config: deps.config,
        clients: aws,
        personId: body.person_id,
        householdId,
        trigger: "manual",
      });
      return c.json({ event_id: eventId });
    },
  );

  return app;
}

export async function startApiServer(config: Config) {
  const log = createLogger(config.logLevel);
  const pool = createPool(config.databaseUrl);
  await runMigrations(pool);

  const app = createApp({ config, pool, log });
  const port = config.apiPort;

  serve({ fetch: app.fetch, port }, () => {
    log.info({ port, cors: config.corsOrigins }, "penny plaid api listening");
  });
}
