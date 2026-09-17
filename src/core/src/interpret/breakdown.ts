import {
  classifyTransaction,
  type ClassifiableTransaction,
  type ClassifiedBucket,
  type MemoryRule,
  type TransactionOverride,
} from "./classifyTransaction.js";
import {
  BREAKDOWN_BUCKET_MAP,
  type ClassifiedBreakdown,
  computeSituation,
  filterLineItemsForBreakdown,
  type SituationComputeInput,
} from "./computeSituation.js";

export type ClassifiedTransactionRow = ClassifiableTransaction & {
  classification: ClassifiedBucket;
  ruleId: string | null;
  source: string;
  displayLabel: string;
};

export function classifyLedger(input: SituationComputeInput) {
  const metrics = computeSituation(input);
  const overrideMap = new Map(
    (input.overrides ?? []).map((o) => [o.plaidTransactionId, o]),
  );
  const rules = input.rules ?? [];

  const transactions: ClassifiedTransactionRow[] = [];
  for (const txn of input.transactions) {
    const result = classifyTransaction(txn, rules, overrideMap);
    if (result.bucket === "skipped_non_depository") continue;
    transactions.push({
      ...txn,
      classification: result.bucket,
      ruleId: result.ruleId,
      source: result.source,
      displayLabel: txn.merchantName ?? txn.rawName ?? "Unknown",
    });
  }

  return { metrics, transactions };
}

export function buildBreakdownResponse(opts: {
  metrics: ReturnType<typeof computeSituation>;
  transactions: ClassifiedTransactionRow[];
  bucket: string;
  limit: number;
  offset: number;
}) {
  const buckets = BREAKDOWN_BUCKET_MAP[opts.bucket];
  if (!buckets) {
    return null;
  }

  const filtered = opts.transactions.filter((t) => buckets.includes(t.classification));
  const lineItems = filterLineItemsForBreakdown(opts.metrics.classified, opts.bucket);

  const totalCents = filtered.reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  const monthlyEstimate = Math.round(
    (totalCents / opts.metrics.meta.windowDays) * 30,
  );

  return {
    bucket: opts.bucket,
    windowDays: opts.metrics.meta.windowDays,
    totalCents,
    monthlyEstimateCents: monthlyEstimate,
    transactionCount: filtered.length,
    lineItems,
    transactions: filtered
      .sort((a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents))
      .slice(opts.offset, opts.offset + opts.limit)
      .map((t) => ({
        plaidTransactionId: t.plaidTransactionId,
        postedDate: t.postedDate,
        amountCents: t.amountCents,
        label: t.displayLabel,
        rawName: t.rawName,
        merchantName: t.merchantName,
        accountId: t.accountId,
        classification: t.classification,
        ruleId: t.ruleId,
        source: t.source,
      })),
    classified: summarizeBuckets(opts.metrics.classified),
  };
}

function summarizeBuckets(classified: ClassifiedBreakdown) {
  return {
    payrollInflowCents: classified.payrollInflowCents,
    otherInflowCents: classified.otherInflowCents,
    operatingOutflowCents: classified.operatingOutflowCents,
    debtServiceOutflowCents: classified.debtServiceOutflowCents,
    ignoredCents: classified.ignoredCents,
    transferCents: classified.transferCents,
    rulesApplied: classified.rulesApplied,
  };
}

export type { TransactionOverride, MemoryRule };
