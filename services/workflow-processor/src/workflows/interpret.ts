import type { Config } from "../config/env.js";
import type { AwsClients } from "../aws/clients.js";
import type { Db } from "../db/pool.js";
import { loadMemoryForHousehold } from "../db/memoryRepos.js";
import {
  getLedgerForInterpret,
  getSituation,
  upsertSituation,
} from "../db/repos.js";
import {
  HouseholdInterpretRequestedDetailSchema,
  SOURCE_HOUSEHOLD,
  type EventEnvelope,
} from "../events/envelope.js";
import { computeSituation } from "../interpret/computeSituation.js";
import type { Logger } from "../logger.js";
import type { Workflow, WorkflowContext } from "./types.js";

export const INTERPRET_WINDOW_DAYS = 90;

export function createInterpretWorkflow(deps: {
  config: Config;
  pool: Db;
  clients: AwsClients;
  log: Logger;
}): Workflow {
  return {
    name: "interpret",
    source: SOURCE_HOUSEHOLD,
    detailType: "HouseholdInterpretRequested",
    schemaVersion: 1,
    async handle(envelope: EventEnvelope, ctx: WorkflowContext): Promise<void> {
      const detail = HouseholdInterpretRequestedDetailSchema.parse(envelope.detail);
      const metrics = await computeSituationForHousehold(
        deps.pool,
        detail.household_id,
        INTERPRET_WINDOW_DAYS,
      );

      const computedAt = new Date().toISOString();
      const existing = await getSituation(deps.pool, detail.household_id);
      const version = (existing?.version ?? 0) + 1;

      await upsertSituation(deps.pool, {
        householdId: detail.household_id,
        version,
        computedAt,
        triggerEventId: detail.event_id,
        syncAttemptId: detail.sync_attempt_id ?? null,
        liquidCents: metrics.liquidCents,
        monthlyOutflowCents: metrics.monthlyOutflowCents,
        monthlyInflowCents: metrics.monthlyInflowCents,
        monthlyOperatingOutflowCents: metrics.monthlyOperatingOutflowCents,
        monthlyPayrollInflowCents: metrics.monthlyPayrollInflowCents,
        runwayMonths: metrics.runwayMonths,
        operatingRunwayMonths: metrics.operatingRunwayMonths,
        debtPosture: metrics.debtPosture,
        incomeShape: metrics.incomeShape,
        liquidityMap: metrics.liquidityMap,
        recurringCommitments: {},
        duplicateCandidates: [],
        classified: metrics.classified,
        meta: metrics.meta,
      });

      deps.log.info(
        {
          householdId: detail.household_id,
          version,
          operatingRunwayMonths: metrics.operatingRunwayMonths,
          monthlyPayrollInflowCents: metrics.monthlyPayrollInflowCents,
          monthlyOperatingOutflowCents: metrics.monthlyOperatingOutflowCents,
          correlationId: ctx.correlationId ?? detail.correlation_id,
        },
        "situation computed",
      );
    },
  };
}

export async function computeSituationForHousehold(
  pool: Db,
  householdId: string,
  windowDays: number,
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
