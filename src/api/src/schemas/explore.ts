import { z } from "zod";
import { exploreQuerySchema } from "@penny/core";

export const exploreQueryRequestSchema = exploreQuerySchema;

export type ExploreQueryRequest = z.infer<typeof exploreQueryRequestSchema>;
