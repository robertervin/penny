import { getLedgerForInterpret } from "../db/repos.js";
import { loadMemoryForHousehold } from "../db/memoryRepos.js";
import type { Db } from "../db/pool.js";
import { INTERPRET_WINDOW_DAYS } from "./computeForHousehold.js";
import { BREAKDOWN_BUCKET_MAP } from "./computeSituation.js";
import { buildBreakdownResponse, classifyLedger } from "./breakdown.js";

export const VALID_BREAKDOWN_BUCKETS = Object.keys(BREAKDOWN_BUCKET_MAP);

export async function getSituationBreakdownForHousehold(
  pool: Db,
  householdId: string,
  opts: { bucket: string; limit: number; offset: number },
) {
  const [ledger, memory] = await Promise.all([
    getLedgerForInterpret(pool, householdId, INTERPRET_WINDOW_DAYS),
    loadMemoryForHousehold(pool, householdId),
  ]);

  const { metrics, transactions } = classifyLedger({
    windowDays: INTERPRET_WINDOW_DAYS,
    accounts: ledger.accounts,
    transactions: ledger.transactions,
    rules: memory.rules,
    overrides: memory.overrides,
  });

  return buildBreakdownResponse({
    metrics,
    transactions,
    bucket: opts.bucket,
    limit: opts.limit,
    offset: opts.offset,
  });
}
