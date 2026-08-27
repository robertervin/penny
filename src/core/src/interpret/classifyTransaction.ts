/** Transaction classification for Interpret v2 (Memory overlay on ledger). */

export type MemoryAction = "ignore" | "payroll" | "transfer" | "debt_service";

export type MemoryRule = {
  id: string;
  matchField: "raw_name" | "merchant_name" | "either";
  matchPattern: string;
  accountId: string | null;
  action: MemoryAction;
};

export type TransactionOverride = {
  plaidTransactionId: string;
  action: MemoryAction | "default";
};

export type ClassifiedBucket =
  | "ignored"
  | "transfer"
  | "payroll_inflow"
  | "other_inflow"
  | "operating_outflow"
  | "debt_service_outflow"
  | "skipped_non_depository";

export type ClassifiableTransaction = {
  plaidTransactionId: string;
  accountId: string;
  accountType: string;
  amountCents: number;
  pending: boolean;
  paymentChannel?: string | null;
  rawName?: string | null;
  merchantName?: string | null;
  postedDate?: string;
};

export type ClassificationResult = {
  bucket: ClassifiedBucket;
  ruleId: string | null;
  source: "override" | "memory_rule" | "heuristic" | "default";
};

function normalizePattern(pattern: string): string {
  return pattern.trim().toUpperCase();
}

function fieldMatches(
  rule: MemoryRule,
  txn: ClassifiableTransaction,
): boolean {
  const pattern = normalizePattern(rule.matchPattern);
  const raw = (txn.rawName ?? "").toUpperCase();
  const merchant = (txn.merchantName ?? "").toUpperCase();

  switch (rule.matchField) {
    case "raw_name":
      return raw.includes(pattern);
    case "merchant_name":
      return merchant.includes(pattern);
    case "either":
      return raw.includes(pattern) || merchant.includes(pattern);
  }
}

function isBuiltInTransfer(txn: ClassifiableTransaction): boolean {
  if (txn.paymentChannel === "transfer") return true;
  const name = (txn.rawName ?? "").toUpperCase();
  return (
    name.includes(" TFR ") ||
    name.includes("TRANSFER") ||
    name.includes("MONEYLINE") ||
    name.startsWith("INTERNET TFR")
  );
}

function bucketFromAction(
  action: MemoryAction,
  txn: ClassifiableTransaction,
): ClassifiedBucket {
  switch (action) {
    case "ignore":
      return "ignored";
    case "transfer":
      return "transfer";
    case "payroll":
      return txn.amountCents < 0 ? "payroll_inflow" : "operating_outflow";
    case "debt_service":
      return txn.amountCents > 0 ? "debt_service_outflow" : "other_inflow";
  }
}

function defaultBucket(txn: ClassifiableTransaction): ClassifiedBucket {
  if (txn.accountType !== "depository") return "skipped_non_depository";
  if (txn.amountCents > 0) return "operating_outflow";
  if (txn.amountCents < 0) return "other_inflow";
  return "skipped_non_depository";
}

export function classifyTransaction(
  txn: ClassifiableTransaction,
  rules: MemoryRule[],
  overrides: Map<string, TransactionOverride>,
): ClassificationResult {
  if (txn.pending) {
    return { bucket: "skipped_non_depository", ruleId: null, source: "default" };
  }

  const override = overrides.get(txn.plaidTransactionId);
  if (override && override.action !== "default") {
    return {
      bucket: bucketFromAction(override.action, txn),
      ruleId: null,
      source: "override",
    };
  }

  for (const rule of rules) {
    if (rule.accountId !== null && rule.accountId !== txn.accountId) continue;
    if (!fieldMatches(rule, txn)) continue;
    return {
      bucket: bucketFromAction(rule.action, txn),
      ruleId: rule.id,
      source: "memory_rule",
    };
  }

  if (txn.accountType === "depository" && isBuiltInTransfer(txn)) {
    return { bucket: "transfer", ruleId: null, source: "heuristic" };
  }

  return { bucket: defaultBucket(txn), ruleId: null, source: "default" };
}

export function matchPatternForTransaction(
  txn: ClassifiableTransaction,
  pattern: string,
  matchField: MemoryRule["matchField"] = "either",
): boolean {
  return fieldMatches(
    { id: "", matchField, matchPattern: pattern, accountId: null, action: "ignore" },
    txn,
  );
}
