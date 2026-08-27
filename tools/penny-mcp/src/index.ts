#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PennyApiClient } from "@penny/api-client";
import { createPennyTools } from "@penny/agent";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const householdId = requireEnv("PENNY_HOUSEHOLD_ID");
const personId = requireEnv("PENNY_PERSON_ID");
const apiUrl = process.env.PENNY_API_URL ?? "http://localhost:3001";

const client = new PennyApiClient(apiUrl);
const { definitions: tools } = createPennyTools(client, { channel: "mcp" });

const server = new Server(
  { name: "penny-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find((t) => t.name === request.params.name);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }

  try {
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const result = await tool.execute(args, {
      householdId,
      personId,
      channel: "mcp",
    });
    return { content: [{ type: "text", text: result }] };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: err instanceof Error ? err.message : String(err),
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
