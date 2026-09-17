import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { ApiServices } from "../services/index.js";
import { handleRouteError } from "../middleware/errorHandler.js";
import { createLinkTokenSchema, exchangePublicTokenSchema } from "../schemas/plaid.js";

export function createPlaidRoutes(services: ApiServices) {
  const routes = new Hono();

  routes.post(
    "/api/plaid/link-token",
    zValidator("json", createLinkTokenSchema),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await services.plaidLink.createLinkToken(body.person_id);
        return c.json(result);
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  routes.post(
    "/api/plaid/exchange",
    zValidator("json", exchangePublicTokenSchema),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await services.plaidLink.exchangePublicToken({
          publicToken: body.public_token,
          personId: body.person_id,
          householdId: body.household_id,
          institution: body.institution,
        });
        return c.json(result);
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  return routes;
}
