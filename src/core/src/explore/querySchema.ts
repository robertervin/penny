import { z } from "zod";

export const exploreMetricSchema = z.enum([
  "income",
  "payroll",
  "outflow",
  "operating_outflow",
  "debt_service",
  "transactions",
]);

export const exploreQuerySchema = z.object({
  metric: exploreMetricSchema,
  window_days: z.number().int().min(1).max(365).default(90),
  account_types: z.array(z.enum(["depository", "credit", "other"])).optional(),
  include_buckets: z.array(z.string()).optional(),
  exclude_buckets: z.array(z.string()).optional(),
  include_label_patterns: z.array(z.string().min(1)).optional(),
  exclude_label_patterns: z.array(z.string().min(1)).optional(),
  group_by: z.enum(["merchant", "day", "account"]).optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

export type ExploreMetric = z.infer<typeof exploreMetricSchema>;
export type ExploreQuery = z.infer<typeof exploreQuerySchema>;
