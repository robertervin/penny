import { z } from "zod";

export const memoryActionSchema = z.enum(["ignore", "payroll", "transfer", "debt_service"]);

export const personIdSchema = z.object({
  person_id: z.string().uuid(),
});

export const triggerInterpretSchema = z.object({
  trigger_interpret: z.boolean().optional(),
});
