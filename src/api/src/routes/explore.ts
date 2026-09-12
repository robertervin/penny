import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { ApiServices } from "../services/index.js";
import { handleRouteError } from "../middleware/errorHandler.js";
import { exploreQueryRequestSchema } from "../schemas/explore.js";

export function createExploreRoutes(services: ApiServices) {
  const routes = new Hono();

  routes.post(
    "/api/household/:householdId/explore/query",
    zValidator("json", exploreQueryRequestSchema),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await services.explore.runQuery(c.req.param("householdId"), body);
        return c.json(result);
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  return routes;
}
