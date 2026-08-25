/** Pure Situation math from ledger-shaped inputs (Interpret v1). */

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

export type LedgerTransaction = {
  accountId: string;
  accountType: string;
  amountCents: number;
  pending: boolean;
  paymentChannel?: string | null;
  rawName?: string | null;
};

export type SituationComputeInput = {
  windowDays: number;
  accounts: AccountBalance[];
  transactions: LedgerTransaction[];
};

export type SituationMetrics = {
  liquidCents: number;
  monthlyOutflowCents: number;
  monthlyInflowCents: number;
  runwayMonths: number | null;
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
    totalInflowCents: number;
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
  meta: {
    windowDays: number;
    depositoryOutflowCents: number;
    depositoryInflowCents: number;
    transactionCount: number;
  };
};

function isInternalTransfer(txn: LedgerTransaction): boolean {
  if (txn.paymentChannel === "transfer") return true;
  const name = (txn.rawName ?? "").toUpperCase();
  return (
    name.includes(" TFR ") ||
    name.includes("TRANSFER") ||
    name.includes("MONEYLINE") ||
    name.startsWith("INTERNET TFR")
  );
}

function balanceCents(account: AccountBalance): number {
  return account.availableCents ?? account.currentCents ?? 0;
}

function isLiquidDepository(account: AccountBalance): boolean {
  return account.includeInRunway && account.type === "depository";
}

export function computeSituation(input: SituationComputeInput): SituationMetrics {
  const { windowDays, accounts, transactions } = input;
  const posted = transactions.filter((t) => !t.pending);

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

  let depositoryOutflowCents = 0;
  let depositoryInflowCents = 0;
  for (const txn of posted) {
    if (txn.accountType !== "depository") continue;
    if (isInternalTransfer(txn)) continue;
    if (txn.amountCents > 0) depositoryOutflowCents += txn.amountCents;
    else if (txn.amountCents < 0) depositoryInflowCents += Math.abs(txn.amountCents);
  }

  const monthlyOutflowCents = Math.round((depositoryOutflowCents / windowDays) * 30);
  const monthlyInflowCents = Math.round((depositoryInflowCents / windowDays) * 30);
  const runwayMonths =
    monthlyOutflowCents > 0
      ? Math.round((liquidCents / monthlyOutflowCents) * 100) / 100
      : null;

  return {
    liquidCents,
    monthlyOutflowCents,
    monthlyInflowCents,
    runwayMonths,
    debtPosture: {
      revolvingBalanceCents,
      accounts: debtAccounts,
    },
    incomeShape: {
      windowDays,
      totalInflowCents: depositoryInflowCents,
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
    meta: {
      windowDays,
      depositoryOutflowCents,
      depositoryInflowCents,
      transactionCount: posted.length,
    },
  };
}
