import { describe, expect, it } from "vitest";
import { formatLlmError } from "../src/router/exploreFallback.js";

describe("formatLlmError", () => {
  it("formats OpenAI quota errors clearly", () => {
    const msg = formatLlmError(new Error('OpenAI API 429: {"code":"insufficient_quota"}'));
    expect(msg).toContain("OpenAI credits");
    expect(msg).toContain("WHY income");
  });
});
