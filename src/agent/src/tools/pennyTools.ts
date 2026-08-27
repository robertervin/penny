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
        "Propose one or more memory rules (SMS: user must confirm before they are saved).",
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
      requiresConfirmOnSms: true,
      execute: async (args) => JSON.stringify({ proposed: args.rules, status: "awaiting_confirmation" }),
    },
    {
      name: "create_memory_rule",
      description: "Create a memory rule immediately (use when user has confirmed or on MCP/Explore).",
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
      requiresConfirmOnSms: true,
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

  const filtered =
    opts.channel === "sms"
      ? definitions.filter((d) => d.name !== "create_memory_rule")
      : definitions.filter((d) => d.name !== "propose_memory_rules");

  return { definitions: filtered, client };
}

export function toolByName(tools: ToolDefinition[], name: string): ToolDefinition | undefined {
  return tools.find((t) => t.name === name);
}
