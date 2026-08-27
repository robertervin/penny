import { describe, expect, it, vi } from "vitest";
import { PennyApiClient } from "@penny/api-client";
import { formatLlmError, tryExploreWithoutLlm } from "../src/router/exploreFallback.js";

describe("tryExploreWithoutLlm", () => {
  it("answers income questions via situation API", async () => {
    const client = {
      getSituation: vi.fn().mockResolvedValue({
        monthlyPayrollInflowCents: 320000,
        monthlyInflowCents: 5800000,
      }),
    } as unknown as PennyApiClient;

    const reply = await tryExploreWithoutLlm(client, "hh-1", "what was my income?");
    expect(reply).toContain("$3,200/mo");
    expect(client.getSituation).toHaveBeenCalledWith("hh-1");
  });

  it("formats OpenAI quota errors clearly", () => {
    const msg = formatLlmError(new Error('OpenAI API 429: {"code":"insufficient_quota"}'));
    expect(msg).toContain("OpenAI credits");
    expect(msg).toContain("WHY income");
  });
});
