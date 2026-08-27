import { loadMemoryForHousehold } from "../db/memoryRepos.js";
import { getLedgerForInterpret } from "../db/repos.js";
import type { Db } from "../db/pool.js";
import { computeSituation } from "./computeSituation.js";

export const INTERPRET_WINDOW_DAYS = 90;

export async function computeSituationForHousehold(
  pool: Db,
  householdId: string,
  windowDays: number = INTERPRET_WINDOW_DAYS,
) {
  const [ledger, memory] = await Promise.all([
    getLedgerForInterpret(pool, householdId, windowDays),
    loadMemoryForHousehold(pool, householdId),
  ]);

  return computeSituation({
    windowDays,
    accounts: ledger.accounts,
    transactions: ledger.transactions,
    rules: memory.rules,
    overrides: memory.overrides,
  });
}
