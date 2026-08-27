import { z } from "zod";
import { memoryActionSchema, personIdSchema, triggerInterpretSchema } from "./common.js";

export const createMemoryRuleSchema = personIdSchema
  .merge(triggerInterpretSchema)
  .extend({
    match_field: z.enum(["raw_name", "merchant_name", "either"]).optional(),
    match_pattern: z.string().min(1),
    account_id: z.string().uuid().nullable().optional(),
    action: memoryActionSchema,
    note: z.string().optional(),
    source_channel: z.string().optional(),
  });

export const updateMemoryRuleSchema = personIdSchema.merge(triggerInterpretSchema).extend({
  active: z.boolean(),
});

export const undoCorrectionSchema = personIdSchema.merge(triggerInterpretSchema);
