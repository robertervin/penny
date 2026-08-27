import { describe, expect, it } from "vitest";
import {
  classifyTransaction,
  matchPatternForTransaction,
  type MemoryRule,
} from "../src/interpret/classifyTransaction.js";

const baseTxn = {
  plaidTransactionId: "txn-1",
  accountId: "acct-1",
  accountType: "depository",
  amountCents: -150_000,
  pending: false,
  rawName: "ROCKET PAYMENT 260731",
  merchantName: null,
  postedDate: "2026-07-31",
};

describe("classifyTransaction", () => {
  it("applies override before memory rules", () => {
    const rules: MemoryRule[] = [
      {
        id: "rule-1",
        matchField: "either",
        matchPattern: "ROCKET",
        accountId: null,
        action: "ignore",
      },
    ];
    const overrides = new Map([
      ["txn-1", { plaidTransactionId: "txn-1", action: "payroll" as const }],
    ]);

    const result = classifyTransaction(baseTxn, rules, overrides);
    expect(result.bucket).toBe("payroll_inflow");
    expect(result.source).toBe("override");
  });

  it("classifies payroll rule on inflows", () => {
    const rules: MemoryRule[] = [
      {
        id: "rocket",
        matchField: "either",
        matchPattern: "ROCKET PAYMENT",
        accountId: null,
        action: "payroll",
      },
    ];

    const result = classifyTransaction(baseTxn, rules, new Map());
    expect(result.bucket).toBe("payroll_inflow");
    expect(result.ruleId).toBe("rocket");
  });

  it("ignores Morgan Stanley via memory rule", () => {
    const txn = {
      ...baseTxn,
      plaidTransactionId: "txn-ms",
      amountCents: -7_397_413,
      rawName: "Morgan Stanley ACH CREDIT260602",
      merchantName: "Morgan Stanley",
    };
    const rules: MemoryRule[] = [
      {
        id: "ms",
        matchField: "either",
        matchPattern: "MORGAN STANLEY",
        accountId: null,
        action: "ignore",
      },
    ];

    const result = classifyTransaction(txn, rules, new Map());
    expect(result.bucket).toBe("ignored");
    expect(result.ruleId).toBe("ms");
  });

  it("uses built-in transfer heuristic when no rule matches", () => {
    const txn = {
      ...baseTxn,
      amountCents: 100_000_00,
      rawName: "INTERNET TFR TO CHECKING 060826",
    };

    const result = classifyTransaction(txn, [], new Map());
    expect(result.bucket).toBe("transfer");
    expect(result.source).toBe("heuristic");
  });

  it("defaults depository outflows to operating_outflow", () => {
    const txn = {
      ...baseTxn,
      amountCents: 3_683_72,
      rawName: "ROCKET MORTGAGE LOAN 260802",
      merchantName: "Rocket Mortgage",
    };

    const result = classifyTransaction(txn, [], new Map());
    expect(result.bucket).toBe("operating_outflow");
  });

  it("routes debt_service rule to debt bucket", () => {
    const txn = {
      ...baseTxn,
      amountCents: 10_932_29,
      rawName: "CHASE CREDIT CRDAUTOPAY 260724",
    };
    const rules: MemoryRule[] = [
      {
        id: "chase",
        matchField: "either",
        matchPattern: "CHASE CREDIT",
        accountId: null,
        action: "debt_service",
      },
    ];

    const result = classifyTransaction(txn, rules, new Map());
    expect(result.bucket).toBe("debt_service_outflow");
  });
});

describe("matchPatternForTransaction", () => {
  it("matches either raw name or merchant", () => {
    expect(
      matchPatternForTransaction(
        { ...baseTxn, merchantName: "Morgan Stanley", rawName: "ACH" },
        "morgan stanley",
      ),
    ).toBe(true);
  });
});
