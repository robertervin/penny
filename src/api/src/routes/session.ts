import { Hono } from "hono";
import type { ApiServices } from "../services/index.js";
import { handleRouteError } from "../middleware/errorHandler.js";

export function createSessionRoutes(services: ApiServices) {
  const routes = new Hono();

  routes.post("/api/session/bootstrap", async (c) => {
    try {
      const session = await services.session.bootstrap();
      return c.json(session);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  return routes;
}
