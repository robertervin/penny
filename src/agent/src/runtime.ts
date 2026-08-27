import type { ProposedMemoryRule } from "@penny/api-client";
import type {
  AgentContext,
  AgentMessage,
  AgentTurnResult,
  LlmClient,
  ToolDefinition,
} from "./types.js";
import { baseSystemPrompt } from "./prompts/system.js";
import { toolByName } from "./tools/pennyTools.js";

export type RunAgentTurnOpts = {
  llm: LlmClient;
  model: string;
  tools: ToolDefinition[];
  context: AgentContext;
  messages: AgentMessage[];
  userMessage: string;
  maxToolRounds?: number;
  /** SMS: intercept write tools and return proposal instead of executing */
  interceptWrites?: boolean;
};

function extractProposal(toolName: string, args: Record<string, unknown>): ProposedMemoryRule[] | undefined {
  if (toolName === "propose_memory_rules" && Array.isArray(args.rules)) {
    return args.rules as ProposedMemoryRule[];
  }
  if (toolName === "create_memory_rule") {
    return [
      {
        matchPattern: String(args.match_pattern),
        action: args.action as ProposedMemoryRule["action"],
        matchField: args.match_field as ProposedMemoryRule["matchField"],
        note: args.note ? String(args.note) : undefined,
      },
    ];
  }
  return undefined;
}

export async function runAgentTurn(opts: RunAgentTurnOpts): Promise<AgentTurnResult> {
  const maxRounds = opts.maxToolRounds ?? 3;
  const messages: AgentMessage[] = [
    { role: "system", content: baseSystemPrompt(opts.context.channel) },
    ...opts.messages,
    { role: "user", content: opts.userMessage },
  ];

  let pendingProposal: ProposedMemoryRule[] | undefined;
  let reply = "";

  for (let round = 0; round < maxRounds; round++) {
    const completion = await opts.llm.complete({
      messages,
      tools: opts.tools,
      model: opts.model,
    });

    if (completion.toolCalls.length === 0) {
      reply = completion.content ?? "I couldn't generate a response.";
      messages.push({ role: "assistant", content: reply });
      break;
    }

    messages.push({
      role: "assistant",
      content: completion.content ?? "",
      toolCalls: completion.toolCalls,
    });

    for (const call of completion.toolCalls) {
      const tool = toolByName(opts.tools, call.name);
      if (!tool) {
        messages.push({
          role: "tool",
          toolCallId: call.id,
          content: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
        });
        continue;
      }

      const args = JSON.parse(call.arguments || "{}") as Record<string, unknown>;

      if (opts.interceptWrites && tool.requiresConfirmOnSms) {
        pendingProposal = extractProposal(call.name, args);
        messages.push({
          role: "tool",
          toolCallId: call.id,
          content: JSON.stringify({
            status: "proposal_recorded",
            message: "Rules proposed; awaiting user YES to apply.",
            rules: pendingProposal,
          }),
        });
        continue;
      }

      const result = await tool.execute(args, opts.context);
      if (tool.name === "propose_memory_rules") {
        pendingProposal = extractProposal(tool.name, args);
      }
      messages.push({ role: "tool", toolCallId: call.id, content: result });
    }

    if (pendingProposal && opts.interceptWrites) {
      reply =
        completion.content ??
        formatProposalReply(pendingProposal);
      messages.push({ role: "assistant", content: reply });
      break;
    }

    if (round === maxRounds - 1) {
      const final = await opts.llm.complete({ messages, tools: [], model: opts.model });
      reply = final.content ?? "Done.";
      messages.push({ role: "assistant", content: reply });
    }
  }

  return { reply, messages, pendingProposal };
}

function formatProposalReply(rules: ProposedMemoryRule[]): string {
  const lines = rules.map((r) => `• "${r.matchPattern}" → ${r.action}`);
  return `I'll save:\n${lines.join("\n")}\nApply to last 90 days? Reply YES / NO`;
}
