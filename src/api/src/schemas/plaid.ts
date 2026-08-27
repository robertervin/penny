import { z } from "zod";

export const createLinkTokenSchema = z.object({
  person_id: z.string().uuid(),
  household_id: z.string().uuid(),
});

export const exchangePublicTokenSchema = z.object({
  public_token: z.string().min(1),
  person_id: z.string().uuid(),
  household_id: z.string().uuid(),
  institution: z
    .object({
      institution_id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});
