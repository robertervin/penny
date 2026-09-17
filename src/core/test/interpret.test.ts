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
        {
          plaidTransactionId: "t1",
          accountId: "a1",
          accountType: "depository",
          amountCents: 10_000,
          pending: false,
          rawName: "GROCERY",
        },
        {
          plaidTransactionId: "t2",
          accountId: "a1",
          accountType: "depository",
          amountCents: 20_000,
          pending: false,
          rawName: "GAS",
        },
        {
          plaidTransactionId: "t3",
          accountId: "a1",
          accountType: "depository",
          amountCents: -50_000,
          pending: false,
          rawName: "PAYROLL CO",
        },
        {
          plaidTransactionId: "t4",
          accountId: "a2",
          accountType: "credit",
          amountCents: 5_000,
          pending: false,
          rawName: "SHOP",
        },
      ],
    });

    expect(result.liquidCents).toBe(420_000);
    expect(result.monthlyOperatingOutflowCents).toBe(10_000);
    expect(result.monthlyPayrollInflowCents).toBe(0);
    expect(result.monthlyInflowCents).toBe(16_667);
    expect(result.operatingRunwayMonths).toBe(42);
    expect(result.classified.debtServiceOutflowCents).toBe(0);
    expect(result.debtPosture.revolvingBalanceCents).toBe(150_000);
  });

  it("applies memory rules to payroll and ignored buckets", () => {
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
          plaidTransactionId: "ms",
          accountId: "a1",
          accountType: "depository",
          amountCents: -100_000_00,
          pending: false,
          rawName: "Morgan Stanley ACH CREDIT",
          merchantName: "Morgan Stanley",
        },
        {
          plaidTransactionId: "rocket",
          accountId: "a1",
          accountType: "depository",
          amountCents: -3_000_00,
          pending: false,
          rawName: "ROCKET PAYMENT 260731",
        },
        {
          plaidTransactionId: "bill",
          accountId: "a1",
          accountType: "depository",
          amountCents: 5_000_00,
          pending: false,
          rawName: "VERIZON",
        },
      ],
      rules: [
        {
          id: "ignore-ms",
          matchField: "either",
          matchPattern: "MORGAN STANLEY",
          accountId: null,
          action: "ignore",
        },
        {
          id: "payroll-rocket",
          matchField: "either",
          matchPattern: "ROCKET PAYMENT",
          accountId: null,
          action: "payroll",
        },
      ],
    });

    expect(result.classified.ignoredCents).toBe(100_000_00);
    expect(result.classified.payrollInflowCents).toBe(3_000_00);
    expect(result.monthlyPayrollInflowCents).toBe(1_000_00);
    expect(result.monthlyInflowCents).toBe(1_000_00);
    expect(result.classified.rulesApplied).toEqual(
      expect.arrayContaining(["ignore-ms", "payroll-rocket"]),
    );
  });

  it("separates debt service from operating outflow", () => {
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
          currentCents: 900_000,
          availableCents: null,
        },
      ],
      transactions: [
        {
          plaidTransactionId: "mortgage",
          accountId: "a1",
          accountType: "depository",
          amountCents: 300_000,
          pending: false,
          rawName: "ROCKET MORTGAGE LOAN",
        },
        {
          plaidTransactionId: "card",
          accountId: "a1",
          accountType: "depository",
          amountCents: 600_000,
          pending: false,
          rawName: "CHASE CREDIT CRDAUTOPAY",
        },
      ],
      rules: [
        {
          id: "debt",
          matchField: "either",
          matchPattern: "CHASE CREDIT",
          accountId: null,
          action: "debt_service",
        },
      ],
    });

    expect(result.classified.operatingOutflowCents).toBe(300_000);
    expect(result.classified.debtServiceOutflowCents).toBe(600_000);
    expect(result.monthlyOperatingOutflowCents).toBe(300_000);
    expect(result.operatingRunwayMonths).toBe(3);
    expect(result.monthlyOutflowCents).toBe(900_000);
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
          plaidTransactionId: "xfer",
          accountId: "a1",
          accountType: "depository",
          amountCents: 100_000_00,
          pending: false,
          rawName: "INTERNET TFR TO CHECKING 060826",
        },
        {
          plaidTransactionId: "bill",
          accountId: "a1",
          accountType: "depository",
          amountCents: 5_000_00,
          pending: false,
          rawName: "GROCERY STORE",
        },
      ],
    });

    expect(result.classified.transferCents).toBe(100_000_00);
    expect(result.monthlyOperatingOutflowCents).toBe(166_667);
  });
});
