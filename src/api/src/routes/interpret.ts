import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { ApiServices } from "../services/index.js";
import { handleRouteError } from "../middleware/errorHandler.js";
import { triggerInterpretRequestSchema } from "../schemas/interpret.js";

export function createInterpretRoutes(services: ApiServices) {
  const routes = new Hono();

  routes.post(
    "/api/household/:householdId/interpret",
    zValidator("json", triggerInterpretRequestSchema),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const { eventId } = await services.interpret.trigger({
          personId: body.person_id,
          householdId: c.req.param("householdId"),
          trigger: "manual",
        });
        return c.json({ event_id: eventId });
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  return routes;
}
