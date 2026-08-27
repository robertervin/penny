import { describe, expect, it } from "vitest";
import { ValidationError } from "../src/errors.js";
import { MemoryCommandService } from "../src/services/MemoryCommandService.js";
import { InterpretTriggerService } from "../src/services/InterpretTriggerService.js";

describe("MemoryCommandService", () => {
  it("rejects activation in v1", async () => {
    const service = new MemoryCommandService({} as never, new InterpretTriggerService({} as never, {} as never));

    await expect(
      service.updateRule({
        householdId: "660e8400-e29b-41d4-a716-446655440001",
        ruleId: "770e8400-e29b-41d4-a716-446655440002",
        personId: "550e8400-e29b-41d4-a716-446655440000",
        active: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
