import { describe, expect, it } from "vitest";
import { formatBreakdownSummary } from "../src/format/sms.js";

describe("formatBreakdownSummary", () => {
  it("explains when there are no transactions", () => {
    const msg = formatBreakdownSummary(
      { bucket: "income", monthlyEstimateCents: 0, transactions: [] },
      "income",
    );
    expect(msg).toContain("No income transactions");
    expect(msg).toContain("Link UI");
    expect(msg).not.toContain("Top lines:");
  });

  it("lists top transactions when present", () => {
    const msg = formatBreakdownSummary(
      {
        bucket: "income",
        monthlyEstimateCents: 320000,
        transactions: [{ label: "Payroll", amountCents: 320000 }],
      },
      "income",
    );
    expect(msg).toContain("$3,200/mo");
    expect(msg).toContain("Payroll");
    expect(msg).toContain("Top lines:");
  });
});
