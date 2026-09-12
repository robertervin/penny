import type { AgentMessage } from "./types.js";

/** Keep user turns and final assistant replies only — safe for cross-turn SMS context. */
export function compactAgentHistory(messages: AgentMessage[]): AgentMessage[] {
  const out: AgentMessage[] = [];
  for (const m of messages) {
    if (m.role === "user") {
      out.push(m);
      continue;
    }
    if (m.role === "assistant" && !m.toolCalls?.length && m.content.trim()) {
      out.push({ role: "assistant", content: m.content });
    }
  }
  return out;
}

/** Drop orphaned tool messages and duplicate system prompts before calling the LLM. */
export function sanitizeAgentMessagesForLlm(messages: AgentMessage[]): AgentMessage[] {
  const out: AgentMessage[] = [];
  let seenSystem = false;

  for (const m of messages) {
    if (m.role === "system") {
      if (seenSystem) continue;
      seenSystem = true;
      out.push(m);
      continue;
    }

    if (m.role === "tool") {
      const prev = out[out.length - 1];
      if (prev?.role === "assistant" && prev.toolCalls?.length) {
        out.push(m);
      }
      continue;
    }

    if (m.role === "assistant" && m.toolCalls?.length) {
      out.push(m);
      continue;
    }

    out.push(m);
  }

  return out;
}
