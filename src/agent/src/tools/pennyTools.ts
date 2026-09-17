import type { PennyApiClient } from "@penny/api-client";
import type { AgentContext, PennyTools, ToolDefinition } from "../types.js";

export function createPennyTools(
  client: PennyApiClient,
  opts: { channel: AgentContext["channel"] },
): PennyTools {
  const definitions: ToolDefinition[] = [
    {
      name: "get_household_status",
      description: "Get linked Plaid items, ledger counts, and current Situation snapshot.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: async (_args, ctx) => JSON.stringify(await client.getHouseholdStatus(ctx.householdId)),
    },
    {
      name: "get_situation",
      description: "Get the latest computed Situation (runway, income, outflow, classified buckets).",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: async (_args, ctx) => JSON.stringify(await client.getSituation(ctx.householdId)),
    },
    {
      name: "run_explore_query",
      description:
        "Run a structured explore query over classified ledger data. Use for ad-hoc questions with filters, time windows, or merchant exclusions. Params: metric (income|payroll|outflow|operating_outflow|debt_service|transactions), window_days (1-365), exclude_label_patterns, include_label_patterns, account_types, group_by (merchant|day|account), limit.",
      parameters: {
        type: "object",
        properties: {
          metric: {
            type: "string",
            enum: ["income", "payroll", "outflow", "operating_outflow", "debt_service", "transactions"],
          },
          window_days: { type: "number" },
          account_types: {
            type: "array",
            items: { type: "string", enum: ["depository", "credit", "other"] },
          },
          include_buckets: { type: "array", items: { type: "string" } },
          exclude_buckets: { type: "array", items: { type: "string" } },
          include_label_patterns: { type: "array", items: { type: "string" } },
          exclude_label_patterns: { type: "array", items: { type: "string" } },
          group_by: { type: "string", enum: ["merchant", "day", "account"] },
          limit: { type: "number" },
        },
        required: ["metric"],
        additionalProperties: false,
      },
      execute: async (args, ctx) =>
        JSON.stringify(
          await client.runExploreQuery(ctx.householdId, args as Record<string, unknown>),
        ),
    },
    {
      name: "get_situation_breakdown",
      description:
        "Get line-item breakdown for a bucket: income, payroll, outflow, operating_outflow, debt_service, ignored, transfer.",
      parameters: {
        type: "object",
        properties: {
          bucket: { type: "string" },
          limit: { type: "number" },
          offset: { type: "number" },
        },
        required: ["bucket"],
        additionalProperties: false,
      },
      execute: async (args, ctx) =>
        JSON.stringify(
          await client.getSituationBreakdown(ctx.householdId, {
            bucket: String(args.bucket),
            limit: args.limit !== undefined ? Number(args.limit) : 10,
            offset: args.offset !== undefined ? Number(args.offset) : 0,
          }),
        ),
    },
    {
      name: "list_memory_rules",
      description: "List active and inactive memory rules for the household.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: async (_args, ctx) => JSON.stringify(await client.listMemoryRules(ctx.householdId)),
    },
    {
      name: "propose_memory_rules",
      description:
        "Propose one or more memory rules. The user must confirm before they are saved.",
      parameters: {
        type: "object",
        properties: {
          rules: {
            type: "array",
            items: {
              type: "object",
              properties: {
                matchPattern: { type: "string" },
                action: {
                  type: "string",
                  enum: ["ignore", "payroll", "transfer", "debt_service"],
                },
                matchField: {
                  type: "string",
                  enum: ["raw_name", "merchant_name", "either"],
                },
                note: { type: "string" },
              },
              required: ["matchPattern", "action"],
            },
          },
        },
        required: ["rules"],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      execute: async (args) => JSON.stringify({ proposed: args.rules, status: "awaiting_confirmation" }),
    },
    {
      name: "create_memory_rule",
      description: "Create a memory rule immediately (use when the user has confirmed, or on MCP).",
      parameters: {
        type: "object",
        properties: {
          match_pattern: { type: "string" },
          action: {
            type: "string",
            enum: ["ignore", "payroll", "transfer", "debt_service"],
          },
          match_field: {
            type: "string",
            enum: ["raw_name", "merchant_name", "either"],
          },
          note: { type: "string" },
          source_channel: { type: "string" },
        },
        required: ["match_pattern", "action"],
        additionalProperties: false,
      },
      requiresConfirmation: true,
      execute: async (args, ctx) =>
        JSON.stringify(
          await client.createMemoryRule(ctx.householdId, {
            person_id: ctx.personId,
            match_pattern: String(args.match_pattern),
            action: args.action as "ignore" | "payroll" | "transfer" | "debt_service",
            match_field: args.match_field as "raw_name" | "merchant_name" | "either" | undefined,
            note: args.note ? String(args.note) : undefined,
            source_channel: args.source_channel ? String(args.source_channel) : ctx.channel,
          }),
        ),
    },
    {
      name: "undo_correction",
      description: "Undo the last memory correction (deactivates the associated rule).",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: async (_args, ctx) =>
        JSON.stringify(
          await client.undoCorrection(ctx.householdId, {
            person_id: ctx.personId,
          }),
        ),
    },
    {
      name: "trigger_interpret",
      description: "Recompute Situation from ledger and memory rules.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute: async (_args, ctx) =>
        JSON.stringify(await client.triggerInterpret(ctx.householdId, { person_id: ctx.personId })),
    },
  ];

  // The app surface must propose and await confirmation; MCP is a dev tool and may write directly.
  const filtered =
    opts.channel === "app"
      ? definitions.filter((d) => d.name !== "create_memory_rule")
      : definitions.filter((d) => d.name !== "propose_memory_rules");

  return { definitions: filtered, client };
}

export function toolByName(tools: ToolDefinition[], name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}
