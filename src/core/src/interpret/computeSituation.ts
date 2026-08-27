import {
  classifyTransaction,
  type ClassifiableTransaction,
  type ClassifiedBucket,
  type MemoryRule,
  type TransactionOverride,
} from "./classifyTransaction.js";

export type AccountBalance = {
  accountId: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  includeInRunway: boolean;
  currentCents: number | null;
  availableCents: number | null;
};

export type LedgerTransaction = ClassifiableTransaction;

export type LineItemSummary = {
  key: string;
  label: string;
  totalCents: number;
  transactionCount: number;
  bucket: ClassifiedBucket;
  ruleId: string | null;
};

export type ClassifiedBreakdown = {
  payrollInflowCents: number;
  otherInflowCents: number;
  operatingOutflowCents: number;
  debtServiceOutflowCents: number;
  ignoredCents: number;
  transferCents: number;
  lineItems: LineItemSummary[];
  rulesApplied: string[];
};

export type SituationComputeInput = {
  windowDays: number;
  accounts: AccountBalance[];
  transactions: LedgerTransaction[];
  rules?: MemoryRule[];
  overrides?: TransactionOverride[];
};

export type SituationMetrics = {
  liquidCents: number;
  monthlyOutflowCents: number;
  monthlyInflowCents: number;
  monthlyOperatingOutflowCents: number;
  monthlyPayrollInflowCents: number;
  runwayMonths: number | null;
  operatingRunwayMonths: number | null;
  debtPosture: {
    revolvingBalanceCents: number;
    accounts: Array<{
      accountId: string;
      name: string;
      mask: string | null;
      balanceCents: number;
    }>;
  };
  incomeShape: {
    windowDays: number;
    payrollInflowCents: number;
    otherInflowCents: number;
    monthlyPayrollInflowCents: number;
    monthlyInflowCents: number;
  };
  liquidityMap: {
    accounts: Array<{
      accountId: string;
      name: string;
      type: string;
      subtype: string | null;
      mask: string | null;
      balanceCents: number;
    }>;
  };
  classified: ClassifiedBreakdown;
  meta: {
    windowDays: number;
    transactionCount: number;
    classifiedTransactionCount: number;
  };
};

function balanceCents(account: AccountBalance): number {
  return account.availableCents ?? account.currentCents ?? 0;
}

function isLiquidDepository(account: AccountBalance): boolean {
  return account.includeInRunway && account.type === "depository";
}

function monthlyFromWindow(totalCents: number, windowDays: number): number {
  return Math.round((totalCents / windowDays) * 30);
}

function runwayMonths(liquidCents: number, monthlyOutflowCents: number): number | null {
  if (monthlyOutflowCents <= 0) return null;
  return Math.round((liquidCents / monthlyOutflowCents) * 100) / 100;
}

function lineItemKey(txn: LedgerTransaction): string {
  return (txn.merchantName ?? txn.rawName ?? "Unknown").trim();
}

function lineItemLabel(key: string): string {
  return key;
}

function addToBucketTotals(
  bucket: ClassifiedBucket,
  amountCents: number,
  totals: ClassifiedBreakdown,
): void {
  const abs = Math.abs(amountCents);
  switch (bucket) {
    case "payroll_inflow":
      totals.payrollInflowCents += abs;
      break;
    case "other_inflow":
      totals.otherInflowCents += abs;
      break;
    case "operating_outflow":
      totals.operatingOutflowCents += abs;
      break;
    case "debt_service_outflow":
      totals.debtServiceOutflowCents += abs;
      break;
    case "ignored":
      totals.ignoredCents += abs;
      break;
    case "transfer":
      totals.transferCents += abs;
      break;
    default:
      break;
  }
}

export function computeSituation(input: SituationComputeInput): SituationMetrics {
  const { windowDays, accounts, transactions } = input;
  const rules = input.rules ?? [];
  const overrideMap = new Map(
    (input.overrides ?? []).map((o) => [o.plaidTransactionId, o]),
  );

  const liquidAccounts = accounts.filter(isLiquidDepository);
  const liquidCents = liquidAccounts.reduce((sum, a) => sum + balanceCents(a), 0);

  const creditAccounts = accounts.filter((a) => a.type === "credit");
  const debtAccounts = creditAccounts
    .map((a) => ({
      accountId: a.accountId,
      name: a.name,
      mask: a.mask,
      balanceCents: balanceCents(a),
    }))
    .filter((a) => a.balanceCents > 0);
  const revolvingBalanceCents = debtAccounts.reduce((sum, a) => sum + a.balanceCents, 0);

  const classified: ClassifiedBreakdown = {
    payrollInflowCents: 0,
    otherInflowCents: 0,
    operatingOutflowCents: 0,
    debtServiceOutflowCents: 0,
    ignoredCents: 0,
    transferCents: 0,
    lineItems: [],
    rulesApplied: [],
  };

  const lineItemMap = new Map<string, LineItemSummary>();
  const rulesAppliedSet = new Set<string>();
  let classifiedTransactionCount = 0;

  for (const txn of transactions) {
    const result = classifyTransaction(txn, rules, overrideMap);
    if (result.bucket === "skipped_non_depository") continue;

    classifiedTransactionCount += 1;
    addToBucketTotals(result.bucket, txn.amountCents, classified);
    if (result.ruleId) rulesAppliedSet.add(result.ruleId);

    const key = `${result.bucket}::${lineItemKey(txn)}`;
    const existing = lineItemMap.get(key);
    const abs = Math.abs(txn.amountCents);
    if (existing) {
      existing.totalCents += abs;
      existing.transactionCount += 1;
    } else {
      lineItemMap.set(key, {
        key,
        label: lineItemLabel(lineItemKey(txn)),
        totalCents: abs,
        transactionCount: 1,
        bucket: result.bucket,
        ruleId: result.ruleId,
      });
    }
  }

  classified.lineItems = [...lineItemMap.values()].sort((a, b) => b.totalCents - a.totalCents);
  classified.rulesApplied = [...rulesAppliedSet];

  const totalInflowCents = classified.payrollInflowCents + classified.otherInflowCents;
  const totalOutflowCents =
    classified.operatingOutflowCents + classified.debtServiceOutflowCents;

  const monthlyPayrollInflowCents = monthlyFromWindow(classified.payrollInflowCents, windowDays);
  const monthlyInflowCents = monthlyFromWindow(totalInflowCents, windowDays);
  const monthlyOperatingOutflowCents = monthlyFromWindow(
    classified.operatingOutflowCents,
    windowDays,
  );
  const monthlyOutflowCents = monthlyFromWindow(totalOutflowCents, windowDays);

  return {
    liquidCents,
    monthlyOutflowCents,
    monthlyInflowCents,
    monthlyOperatingOutflowCents,
    monthlyPayrollInflowCents,
    runwayMonths: runwayMonths(liquidCents, monthlyOutflowCents),
    operatingRunwayMonths: runwayMonths(liquidCents, monthlyOperatingOutflowCents),
    debtPosture: {
      revolvingBalanceCents,
      accounts: debtAccounts,
    },
    incomeShape: {
      windowDays,
      payrollInflowCents: classified.payrollInflowCents,
      otherInflowCents: classified.otherInflowCents,
      monthlyPayrollInflowCents,
      monthlyInflowCents,
    },
    liquidityMap: {
      accounts: liquidAccounts.map((a) => ({
        accountId: a.accountId,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
        balanceCents: balanceCents(a),
      })),
    },
    classified,
    meta: {
      windowDays,
      transactionCount: transactions.length,
      classifiedTransactionCount,
    },
  };
}

/** Map API breakdown bucket param to classified buckets. */
export const BREAKDOWN_BUCKET_MAP: Record<string, ClassifiedBucket[]> = {
  income: ["payroll_inflow", "other_inflow"],
  payroll: ["payroll_inflow"],
  outflow: ["operating_outflow", "debt_service_outflow"],
  operating_outflow: ["operating_outflow"],
  debt_service: ["debt_service_outflow"],
  ignored: ["ignored"],
  transfer: ["transfer"],
};

export function filterLineItemsForBreakdown(
  classified: ClassifiedBreakdown,
  bucket: string,
): LineItemSummary[] {
  const buckets = BREAKDOWN_BUCKET_MAP[bucket];
  if (!buckets) return [];
  return classified.lineItems.filter((item) => buckets.includes(item.bucket));
}
