import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { CountryCode, Products } from "plaid";
import type { Config } from "../config/env.js";
import { createAwsClients } from "../aws/clients.js";
import { TokenVault } from "../crypto/tokenVault.js";
import {
  deactivateMemoryRule,
  getLastUndoableCorrection,
  insertCorrection,
  insertMemoryRule,
  listMemoryRules,
  loadMemoryForHousehold,
  markCorrectionUndone,
} from "../db/memoryRepos.js";
import { createPool, runMigrations } from "../db/pool.js";
import {
  countLedgerForHousehold,
  getLedgerForInterpret,
  getOrCreateLocalHousehold,
  getSituation,
  insertPlaidItem,
  listPlaidItemsForHousehold,
} from "../db/repos.js";
import { publishHouseholdInterpretRequested } from "../events/publishInterpret.js";
import { publishPlaidSyncRequested } from "../events/publishSync.js";
import { buildBreakdownResponse, classifyLedger } from "../interpret/breakdown.js";
import { INTERPRET_WINDOW_DAYS } from "../workflows/interpret.js";
import { createLogger } from "../logger.js";
import { createPlaidApi } from "../plaid/client.js";

const memoryActionSchema = z.enum(["ignore", "payroll", "transfer", "debt_service"]);

function formatSituation(situation: NonNullable<Awaited<ReturnType<typeof getSituation>>>) {
  return {
    householdId: situation.household_id,
    version: situation.version,
    computedAt: situation.computed_at,
    runwayMonths: situation.runway_months !== null ? Number(situation.runway_months) : null,
    operatingRunwayMonths:
      situation.operating_runway_months !== null
        ? Number(situation.operating_runway_months)
        : null,
    liquidCents: situation.liquid_cents !== null ? Number(situation.liquid_cents) : null,
    monthlyOutflowCents:
      situation.monthly_outflow_cents !== null ? Number(situation.monthly_outflow_cents) : null,
    monthlyOperatingOutflowCents:
      situation.monthly_operating_outflow_cents !== null
        ? Number(situation.monthly_operating_outflow_cents)
        : null,
    monthlyInflowCents:
      situation.monthly_inflow_cents !== null ? Number(situation.monthly_inflow_cents) : null,
    monthlyPayrollInflowCents:
      situation.monthly_payroll_inflow_cents !== null
        ? Number(situation.monthly_payroll_inflow_cents)
        : null,
    debtPosture: situation.debt_posture,
    incomeShape: situation.income_shape,
    liquidityMap: situation.liquidity_map,
    classified: situation.classified,
    meta: situation.meta,
  };
}

async function triggerInterpret(opts: {
  config: Config;
  aws: ReturnType<typeof createAwsClients>;
  personId: string;
  householdId: string;
  trigger: "manual" | "correction";
}) {
  return publishHouseholdInterpretRequested({
    config: opts.config,
    clients: opts.aws,
    personId: opts.personId,
    householdId: opts.householdId,
    trigger: opts.trigger,
  });
}

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
      situation: situation ? formatSituation(situation) : null,
    });
  });

  app.get("/api/household/:householdId/situation", async (c) => {
    const householdId = c.req.param("householdId");
    const situation = await getSituation(deps.pool, householdId);
    if (!situation) {
      return c.json({ error: "Situation not computed yet" }, 404);
    }
    return c.json(formatSituation(situation));
  });

  app.get("/api/household/:householdId/situation/breakdown", async (c) => {
    const householdId = c.req.param("householdId");
    const bucket = c.req.query("bucket") ?? "income";
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
    const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

    const [ledger, memory] = await Promise.all([
      getLedgerForInterpret(deps.pool, householdId, INTERPRET_WINDOW_DAYS),
      loadMemoryForHousehold(deps.pool, householdId),
    ]);

    const { metrics, transactions } = classifyLedger({
      windowDays: INTERPRET_WINDOW_DAYS,
      accounts: ledger.accounts,
      transactions: ledger.transactions,
      rules: memory.rules,
      overrides: memory.overrides,
    });

    const breakdown = buildBreakdownResponse({
      metrics,
      transactions,
      bucket,
      limit,
      offset,
    });

    if (!breakdown) {
      return c.json(
        {
          error: "Invalid bucket",
          validBuckets: [
            "income",
            "payroll",
            "outflow",
            "operating_outflow",
            "debt_service",
            "ignored",
            "transfer",
          ],
        },
        400,
      );
    }

    return c.json(breakdown);
  });

  app.get("/api/household/:householdId/memory/rules", async (c) => {
    const householdId = c.req.param("householdId");
    const rules = await listMemoryRules(deps.pool, householdId);
    return c.json({
      rules: rules.map((r) => ({
        id: r.id,
        matchField: r.match_field,
        matchPattern: r.match_pattern,
        accountId: r.account_id,
        action: r.action,
        note: r.note,
        active: r.active,
        sourceChannel: r.source_channel,
        createdAt: r.created_at,
      })),
    });
  });

  app.post(
    "/api/household/:householdId/memory/rules",
    zValidator(
      "json",
      z.object({
        person_id: z.string().uuid(),
        match_field: z.enum(["raw_name", "merchant_name", "either"]).optional(),
        match_pattern: z.string().min(1),
        account_id: z.string().uuid().nullable().optional(),
        action: memoryActionSchema,
        note: z.string().optional(),
        source_channel: z.string().optional(),
        trigger_interpret: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const householdId = c.req.param("householdId");
      const body = c.req.valid("json");

      const rule = await insertMemoryRule(deps.pool, {
        householdId,
        matchField: body.match_field,
        matchPattern: body.match_pattern,
        accountId: body.account_id,
        action: body.action,
        sourceChannel: body.source_channel ?? "api",
        createdBy: body.person_id,
        note: body.note,
      });

      await insertCorrection(deps.pool, {
        householdId,
        personId: body.person_id,
        channel: body.source_channel ?? "api",
        parsedIntent: {
          type: "create_memory_rule",
          matchPattern: rule.match_pattern,
          action: rule.action,
        },
        ruleId: rule.id,
      });

      let interpretEventId: string | undefined;
      if (body.trigger_interpret !== false) {
        const result = await triggerInterpret({
          config: deps.config,
          aws,
          personId: body.person_id,
          householdId,
          trigger: "correction",
        });
        interpretEventId = result.eventId;
      }

      return c.json({
        rule: {
          id: rule.id,
          matchField: rule.match_field,
          matchPattern: rule.match_pattern,
          action: rule.action,
          note: rule.note,
        },
        interpret_event_id: interpretEventId,
      });
    },
  );

  app.patch(
    "/api/household/:householdId/memory/rules/:ruleId",
    zValidator(
      "json",
      z.object({
        person_id: z.string().uuid(),
        active: z.boolean(),
        trigger_interpret: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const householdId = c.req.param("householdId");
      const ruleId = c.req.param("ruleId");
      const body = c.req.valid("json");

      if (!body.active) {
        const ok = await deactivateMemoryRule(deps.pool, householdId, ruleId);
        if (!ok) return c.json({ error: "Rule not found or already inactive" }, 404);

        await insertCorrection(deps.pool, {
          householdId,
          personId: body.person_id,
          channel: "api",
          parsedIntent: { type: "deactivate_memory_rule", ruleId },
          ruleId,
        });
      } else {
        return c.json({ error: "Only deactivation supported in v1" }, 400);
      }

      let interpretEventId: string | undefined;
      if (body.trigger_interpret !== false) {
        const result = await triggerInterpret({
          config: deps.config,
          aws,
          personId: body.person_id,
          householdId,
          trigger: "correction",
        });
        interpretEventId = result.eventId;
      }

      return c.json({ ok: true, interpret_event_id: interpretEventId });
    },
  );

  app.post(
    "/api/household/:householdId/corrections/undo",
    zValidator(
      "json",
      z.object({
        person_id: z.string().uuid(),
        trigger_interpret: z.boolean().optional(),
      }),
    ),
    async (c) => {
      const householdId = c.req.param("householdId");
      const body = c.req.valid("json");

      const correction = await getLastUndoableCorrection(deps.pool, householdId);
      if (!correction?.rule_id) {
        return c.json({ error: "Nothing to undo" }, 404);
      }

      const ok = await deactivateMemoryRule(deps.pool, householdId, correction.rule_id);
      if (!ok) {
        return c.json({ error: "Associated rule could not be deactivated" }, 409);
      }

      await markCorrectionUndone(deps.pool, correction.id);

      let interpretEventId: string | undefined;
      if (body.trigger_interpret !== false) {
        const result = await triggerInterpret({
          config: deps.config,
          aws,
          personId: body.person_id,
          householdId,
          trigger: "correction",
        });
        interpretEventId = result.eventId;
      }

      return c.json({
        undone_correction_id: correction.id,
        deactivated_rule_id: correction.rule_id,
        interpret_event_id: interpretEventId,
      });
    },
  );

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
      const { eventId } = await triggerInterpret({
        config: deps.config,
        aws,
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
