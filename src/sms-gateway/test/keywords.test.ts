import { describe, expect, it } from "vitest";
import { parseKeywordMessage } from "../src/parse/keywords.js";

describe("parseKeywordMessage", () => {
  it("parses WHY income", () => {
    expect(parseKeywordMessage("why income")).toEqual({ type: "why", bucket: "income" });
  });

  it("parses confirm", () => {
    expect(parseKeywordMessage("YES")).toEqual({ type: "confirm", answer: "yes" });
  });

  it("returns none for free text", () => {
    expect(parseKeywordMessage("what is my runway?")).toEqual({ type: "none" });
  });
});
