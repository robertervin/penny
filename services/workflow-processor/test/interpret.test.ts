import { describe, expect, it } from "vitest";
import { computeSituation } from "../src/interpret/computeSituation.js";

describe("computeSituation", () => {
  it("computes runway from depository liquid cash and outflows", () => {
    const result = computeSituation({
      windowDays: 90,
      accounts: [
        {
          accountId: "a1",
          name: "Checking",
          type: "depository",
          subtype: "checking",
          mask: "1234",
          includeInRunway: true,
          currentCents: 420_000,
          availableCents: 420_000,
        },
        {
          accountId: "a2",
          name: "Credit Card",
          type: "credit",
          subtype: "credit card",
          mask: "9999",
          includeInRunway: true,
          currentCents: 150_000,
          availableCents: null,
        },
      ],
      transactions: [
        { accountId: "a1", accountType: "depository", amountCents: 10_000, pending: false },
        { accountId: "a1", accountType: "depository", amountCents: 20_000, pending: false },
        { accountId: "a1", accountType: "depository", amountCents: -50_000, pending: false },
        { accountId: "a2", accountType: "credit", amountCents: 5_000, pending: false },
      ],
    });

    expect(result.liquidCents).toBe(420_000);
    expect(result.monthlyOutflowCents).toBe(10_000);
    expect(result.monthlyInflowCents).toBe(16_667);
    expect(result.runwayMonths).toBe(42);
    expect(result.debtPosture.revolvingBalanceCents).toBe(150_000);
    expect(result.liquidityMap.accounts).toHaveLength(1);
  });

  it("excludes internal transfers from outflow", () => {
    const result = computeSituation({
      windowDays: 90,
      accounts: [
        {
          accountId: "a1",
          name: "Checking",
          type: "depository",
          subtype: "checking",
          mask: null,
          includeInRunway: true,
          currentCents: 300_000,
          availableCents: null,
        },
      ],
      transactions: [
        {
          accountId: "a1",
          accountType: "depository",
          amountCents: 100_000_00,
          pending: false,
          rawName: "INTERNET TFR TO CHECKING 060826",
        },
        {
          accountId: "a1",
          accountType: "depository",
          amountCents: 5_000_00,
          pending: false,
          rawName: "GROCERY STORE",
        },
      ],
    });

    expect(result.monthlyOutflowCents).toBe(166_667);
  });

  it("returns null runway when there is no outflow", () => {
    const result = computeSituation({
      windowDays: 30,
      accounts: [
        {
          accountId: "a1",
          name: "Checking",
          type: "depository",
          subtype: "checking",
          mask: null,
          includeInRunway: true,
          currentCents: 100_000,
          availableCents: null,
        },
      ],
      transactions: [],
    });

    expect(result.runwayMonths).toBeNull();
    expect(result.monthlyOutflowCents).toBe(0);
  });
});
