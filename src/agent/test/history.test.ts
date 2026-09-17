import { describe, expect, it } from "vitest";
import { compactAgentHistory, sanitizeAgentMessagesForLlm } from "../src/history.js";
import type { AgentMessage } from "../src/types.js";

describe("compactAgentHistory", () => {
  it("keeps user and final assistant text only", () => {
    const messages: AgentMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "what is income?" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "run_explore_query", arguments: "{}" }],
      },
      { role: "tool", toolCallId: "c1", content: "{}" },
      { role: "assistant", content: "About $16k/mo." },
    ];

    expect(compactAgentHistory(messages)).toEqual([
      { role: "user", content: "what is income?" },
      { role: "assistant", content: "About $16k/mo." },
    ]);
  });
});

describe("sanitizeAgentMessagesForLlm", () => {
  it("drops orphaned tool messages after history slice", () => {
    const messages: AgentMessage[] = [
      { role: "system", content: "sys" },
      { role: "tool", toolCallId: "c1", content: "orphan" },
      { role: "user", content: "hello" },
    ];

    expect(sanitizeAgentMessagesForLlm(messages)).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "hello" },
    ]);
  });

  it("keeps valid assistant tool call chains", () => {
    const messages: AgentMessage[] = [
      { role: "system", content: "sys" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "run_explore_query", arguments: "{}" }],
      },
      { role: "tool", toolCallId: "c1", content: "{}" },
    ];

    expect(sanitizeAgentMessagesForLlm(messages)).toHaveLength(3);
  });
});
