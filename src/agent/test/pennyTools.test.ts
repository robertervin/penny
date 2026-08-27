import { describe, expect, it } from "vitest";
import { PennyApiClient } from "@penny/api-client";
import { createPennyTools } from "../src/tools/pennyTools.js";

describe("createPennyTools", () => {
  it("excludes create_memory_rule on SMS channel", () => {
    const { definitions } = createPennyTools(new PennyApiClient("http://localhost:3001"), {
      channel: "sms",
    });
    expect(definitions.some((d) => d.name === "create_memory_rule")).toBe(false);
    expect(definitions.some((d) => d.name === "propose_memory_rules")).toBe(true);
  });

  it("excludes propose_memory_rules on MCP channel", () => {
    const { definitions } = createPennyTools(new PennyApiClient("http://localhost:3001"), {
      channel: "mcp",
    });
    expect(definitions.some((d) => d.name === "propose_memory_rules")).toBe(false);
    expect(definitions.some((d) => d.name === "create_memory_rule")).toBe(true);
  });
});
