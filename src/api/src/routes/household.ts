import { Hono } from "hono";
import type { ApiServices } from "../services/index.js";
import { handleRouteError } from "../middleware/errorHandler.js";

export function createHouseholdRoutes(services: ApiServices) {
  const routes = new Hono();

  routes.get("/api/household/:householdId/status", async (c) => {
    try {
      const status = await services.householdStatus.getStatus(c.req.param("householdId"));
      return c.json(status);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  return routes;
}
