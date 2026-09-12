import { loadMemoryForHousehold } from "../db/memoryRepos.js";
import { getLedgerForInterpret } from "../db/repos.js";
import type { Db } from "../db/pool.js";
import { classifyLedger, type ClassifiedTransactionRow } from "../interpret/breakdown.js";
import type { ClassifiedBucket } from "../interpret/classifyTransaction.js";
import { BREAKDOWN_BUCKET_MAP } from "../interpret/computeSituation.js";
import type { SituationComputeInput } from "../interpret/computeSituation.js";
import type { ExploreQuery } from "./querySchema.js";

export type ExploreLine = {
  label: string;
  cents: number;
  count: number;
};

export type ExploreQueryResult = {
  metric: ExploreQuery["metric"];
  windowDays: number;
  query: ExploreQuery;
  totalCents: number;
  monthlyEstimateCents: number;
  excludedCents: number;
  transactionCount: number;
  lines: ExploreLine[];
};

const METRIC_BUCKETS: Record<ExploreQuery["metric"], ClassifiedBucket[]> = {
  income: BREAKDOWN_BUCKET_MAP.income,
  payroll: BREAKDOWN_BUCKET_MAP.payroll,
  outflow: BREAKDOWN_BUCKET_MAP.outflow,
  operating_outflow: BREAKDOWN_BUCKET_MAP.operating_outflow,
  debt_service: BREAKDOWN_BUCKET_MAP.debt_service,
  transactions: [
    "payroll_inflow",
    "other_inflow",
    "operating_outflow",
    "debt_service_outflow",
    "transfer",
    "ignored",
  ],
};

function labelText(txn: ClassifiedTransactionRow): string {
  return txn.displayLabel ?? txn.merchantName ?? txn.rawName ?? "Unknown";
}

function labelMatches(txn: ClassifiedTransactionRow, pattern: string): boolean {
  const needle = pattern.trim().toUpperCase();
  if (!needle) return false;
  const haystacks = [labelText(txn), txn.rawName ?? "", txn.merchantName ?? ""].map((s) =>
    s.toUpperCase(),
  );
  return haystacks.some((h) => h.includes(needle));
}

function matchesAnyLabel(txn: ClassifiedTransactionRow, patterns: string[] | undefined): boolean {
  if (!patterns?.length) return false;
  return patterns.some((p) => labelMatches(txn, p));
}

function bucketAllowed(txn: ClassifiedTransactionRow, query: ExploreQuery): boolean {
  if (query.include_buckets?.length) {
    return query.include_buckets.includes(txn.classification);
  }
  if (query.exclude_buckets?.length && query.exclude_buckets.includes(txn.classification)) {
    return false;
  }
  return METRIC_BUCKETS[query.metric].includes(txn.classification);
}

function accountTypeAllowed(txn: ClassifiedTransactionRow, query: ExploreQuery): boolean {
  if (!query.account_types?.length) return true;
  return query.account_types.includes(txn.accountType as "depository" | "credit" | "other");
}

function groupKey(txn: ClassifiedTransactionRow, groupBy: ExploreQuery["group_by"]): string {
  switch (groupBy) {
    case "day":
      return txn.postedDate ?? "unknown";
    case "account":
      return txn.accountId;
    case "merchant":
    default:
      return labelText(txn);
  }
}

export function runExploreQueryOnLedger(
  input: SituationComputeInput,
  query: ExploreQuery,
): ExploreQueryResult {
  const { transactions } = classifyLedger(input);
  const windowDays = input.windowDays;

  let excludedCents = 0;
  const included: ClassifiedTransactionRow[] = [];

  for (const txn of transactions) {
    if (!bucketAllowed(txn, query)) continue;
    if (!accountTypeAllowed(txn, query)) continue;

    if (query.include_label_patterns?.length) {
      if (!matchesAnyLabel(txn, query.include_label_patterns)) continue;
    }

    if (matchesAnyLabel(txn, query.exclude_label_patterns)) {
      excludedCents += Math.abs(txn.amountCents);
      continue;
    }

    included.push(txn);
  }

  const totalCents = included.reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const monthlyEstimateCents = Math.round((totalCents / windowDays) * 30);

  const grouped = new Map<string, ExploreLine>();
  for (const txn of included) {
    const key = groupKey(txn, query.group_by ?? "merchant");
    const existing = grouped.get(key);
    const cents = Math.abs(txn.amountCents);
    if (existing) {
      existing.cents += cents;
      existing.count += 1;
    } else {
      grouped.set(key, { label: key, cents, count: 1 });
    }
  }

  const lines = [...grouped.values()]
    .sort((a, b) => b.cents - a.cents)
    .slice(0, query.limit);

  return {
    metric: query.metric,
    windowDays,
    query,
    totalCents,
    monthlyEstimateCents,
    excludedCents,
    transactionCount: included.length,
    lines,
  };
}

export async function executeExploreQuery(
  pool: Db,
  householdId: string,
  query: ExploreQuery,
): Promise<ExploreQueryResult> {
  const windowDays = query.window_days;
  const [ledger, memory] = await Promise.all([
    getLedgerForInterpret(pool, householdId, windowDays),
    loadMemoryForHousehold(pool, householdId),
  ]);

  return runExploreQueryOnLedger(
    {
      windowDays,
      accounts: ledger.accounts,
      transactions: ledger.transactions,
      rules: memory.rules,
      overrides: memory.overrides,
    },
    query,
  );
}
