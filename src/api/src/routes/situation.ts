import { Hono } from "hono";
import type { ApiServices } from "../services/index.js";
import { handleRouteError } from "../middleware/errorHandler.js";

export function createSituationRoutes(services: ApiServices) {
  const routes = new Hono();

  routes.get("/api/household/:householdId/situation", async (c) => {
    try {
      const situation = await services.situation.getSituation(c.req.param("householdId"));
      return c.json(situation);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  routes.get("/api/household/:householdId/situation/breakdown", async (c) => {
    try {
      const householdId = c.req.param("householdId");
      const bucket = c.req.query("bucket") ?? "income";
      const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
      const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

      const breakdown = await services.situation.getBreakdown(householdId, {
        bucket,
        limit,
        offset,
      });

      return c.json(breakdown);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  return routes;
}
