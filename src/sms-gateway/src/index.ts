import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { createLogger, createPool, runMigrations } from "@penny/core";
import { loadConfig } from "./config/env.js";
import { MessageRouter } from "./router/MessageRouter.js";

export function createSmsApp(router: MessageRouter, devMode: boolean) {
  const app = new Hono();

  if (devMode) {
    app.use(
      "*",
      cors({
        origin: [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:5174",
          "http://127.0.0.1:5174",
        ],
        credentials: true,
      }),
    );
  }

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/webhook/twilio", async (c) => {
    const form = await c.req.parseBody();
    const from = String(form.From ?? "");
    const body = String(form.Body ?? "");
    const outbound = await router.handle({ from, body });
    return c.text(twiml(outbound.body));
  });

  if (devMode) {
    app.post("/dev/sms", async (c) => {
      const json = await c.req.json<{ from?: string; body: string }>();
      const from = json.from ?? "+15555550100";
      const outbound = await router.handle({ from, body: json.body });
      return c.json(outbound);
    });
  }

  return app;
}

function twiml(body: string): string {
  const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

async function main() {
  const config = loadConfig();
  const log = createLogger(config.logLevel, "penny-sms-gateway");
  const pool = createPool(config.databaseUrl);
  await runMigrations(pool);

  const router = new MessageRouter(pool, config);
  const app = createSmsApp(router, config.devMode);

  serve({ fetch: app.fetch, port: config.smsPort }, () => {
    log.info(
      {
        port: config.smsPort,
        pennyApi: config.pennyApiUrl,
        devMode: config.devMode,
        llm: Boolean(config.openAiApiKey),
      },
      "penny sms gateway listening",
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
