import type { PennyApiClient, ProposedMemoryRule } from "@penny/api-client";

export type AgentChannel = "sms" | "mcp" | "explore";

export type AgentContext = {
  householdId: string;
  personId: string;
  channel: AgentChannel;
};

export type AgentMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, ctx: AgentContext) => Promise<string>;
  /** SMS: writes require user confirmation before execute */
  requiresConfirmOnSms?: boolean;
};

export type AgentTurnResult = {
  reply: string;
  messages: AgentMessage[];
  pendingProposal?: ProposedMemoryRule[];
};

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export interface LlmClient {
  complete(opts: {
    messages: AgentMessage[];
    tools: ToolDefinition[];
    model: string;
  }): Promise<{
    content: string | null;
    toolCalls: LlmToolCall[];
  }>;
}

export type PennyTools = {
  definitions: ToolDefinition[];
  client: PennyApiClient;
};
