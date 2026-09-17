import { describe, expect, it } from "vitest";
import { InterpretTriggerService } from "../src/services/InterpretTriggerService.js";

describe("InterpretTriggerService", () => {
  it("skips publish when trigger_interpret is false", async () => {
    const service = new InterpretTriggerService({} as never, {} as never);

    const eventId = await service.maybeTrigger({
      personId: "550e8400-e29b-41d4-a716-446655440000",
      householdId: "660e8400-e29b-41d4-a716-446655440001",
      trigger: "correction",
      enabled: false,
    });

    expect(eventId).toBeUndefined();
  });
});
