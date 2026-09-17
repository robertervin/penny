import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { ApiServices } from "../services/index.js";
import { handleRouteError } from "../middleware/errorHandler.js";
import {
  createMemoryRuleSchema,
  undoCorrectionSchema,
  updateMemoryRuleSchema,
} from "../schemas/memory.js";

export function createMemoryRoutes(services: ApiServices) {
  const routes = new Hono();

  routes.get("/api/household/:householdId/memory/rules", async (c) => {
    try {
      const result = await services.memory.listRules(c.req.param("householdId"));
      return c.json(result);
    } catch (err) {
      return handleRouteError(c, err);
    }
  });

  routes.post(
    "/api/household/:householdId/memory/rules",
    zValidator("json", createMemoryRuleSchema),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await services.memory.createRule({
          householdId: c.req.param("householdId"),
          personId: body.person_id,
          matchField: body.match_field,
          matchPattern: body.match_pattern,
          accountId: body.account_id,
          action: body.action,
          note: body.note,
          sourceChannel: body.source_channel,
          triggerInterpret: body.trigger_interpret,
        });
        return c.json(result);
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  routes.patch(
    "/api/household/:householdId/memory/rules/:ruleId",
    zValidator("json", updateMemoryRuleSchema),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await services.memory.updateRule({
          householdId: c.req.param("householdId"),
          ruleId: c.req.param("ruleId"),
          personId: body.person_id,
          active: body.active,
          triggerInterpret: body.trigger_interpret,
        });
        return c.json(result);
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  routes.post(
    "/api/household/:householdId/corrections/undo",
    zValidator("json", undoCorrectionSchema),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await services.memory.undoLastCorrection({
          householdId: c.req.param("householdId"),
          personId: body.person_id,
          triggerInterpret: body.trigger_interpret,
        });
        return c.json(result);
      } catch (err) {
        return handleRouteError(c, err);
      }
    },
  );

  return routes;
}
