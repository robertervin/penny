import { describe, expect, it } from "vitest";
import { runExploreQueryOnLedger } from "../src/explore/queryExecutor.js";
import type { ExploreQuery } from "../src/explore/querySchema.js";

const baseAccounts = [
  {
    accountId: "a1",
    name: "Checking",
    type: "depository",
    subtype: "checking",
    mask: "1234",
    includeInRunway: true,
    currentCents: 500_000,
    availableCents: 500_000,
  },
];

const baseTransactions = [
  {
    plaidTransactionId: "t1",
    accountId: "a1",
    accountType: "depository",
    amountCents: -100_000,
    pending: false,
    rawName: "MORGAN STANLEY ACH CREDIT",
    merchantName: "Morgan Stanley",
    postedDate: "2026-08-01",
  },
  {
    plaidTransactionId: "t2",
    accountId: "a1",
    accountType: "depository",
    amountCents: -50_000,
    pending: false,
    rawName: "ROCKET PAYMENT 260807",
    postedDate: "2026-08-05",
  },
  {
    plaidTransactionId: "t3",
    accountId: "a1",
    accountType: "depository",
    amountCents: 20_000,
    pending: false,
    rawName: "GROCERY",
    postedDate: "2026-08-06",
  },
];

describe("runExploreQueryOnLedger", () => {
  it("sums income excluding a merchant pattern", () => {
    const query: ExploreQuery = {
      metric: "income",
      window_days: 30,
      exclude_label_patterns: ["morgan stanley"],
      limit: 10,
    };

    const result = runExploreQueryOnLedger(
      { windowDays: 30, accounts: baseAccounts, transactions: baseTransactions },
      query,
    );

    expect(result.totalCents).toBe(50_000);
    expect(result.excludedCents).toBe(100_000);
    expect(result.transactionCount).toBe(1);
    expect(result.lines[0]?.label).toContain("ROCKET");
  });

  it("respects window_days in monthly estimate", () => {
    const query: ExploreQuery = {
      metric: "income",
      window_days: 30,
      limit: 10,
    };

    const result = runExploreQueryOnLedger(
      { windowDays: 30, accounts: baseAccounts, transactions: baseTransactions },
      query,
    );

    expect(result.totalCents).toBe(150_000);
    expect(result.monthlyEstimateCents).toBe(150_000);
  });

  it("filters operating outflow only", () => {
    const query: ExploreQuery = {
      metric: "operating_outflow",
      window_days: 90,
      limit: 10,
    };

    const result = runExploreQueryOnLedger(
      { windowDays: 90, accounts: baseAccounts, transactions: baseTransactions },
      query,
    );

    expect(result.totalCents).toBe(20_000);
    expect(result.transactionCount).toBe(1);
  });
});
