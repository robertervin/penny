import type { Config } from "../config/env.js";
import type { AwsClients } from "../aws/clients.js";
import type { Db } from "../db/pool.js";
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

const INTERPRET_WINDOW_DAYS = 90;

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
      const ledger = await getLedgerForInterpret(deps.pool, detail.household_id, INTERPRET_WINDOW_DAYS);

      const metrics = computeSituation({
        windowDays: INTERPRET_WINDOW_DAYS,
        accounts: ledger.accounts,
        transactions: ledger.transactions,
      });

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
        runwayMonths: metrics.runwayMonths,
        debtPosture: metrics.debtPosture,
        incomeShape: metrics.incomeShape,
        liquidityMap: metrics.liquidityMap,
        recurringCommitments: {},
        duplicateCandidates: [],
        meta: metrics.meta,
      });

      deps.log.info(
        {
          householdId: detail.household_id,
          version,
          runwayMonths: metrics.runwayMonths,
          liquidCents: metrics.liquidCents,
          monthlyOutflowCents: metrics.monthlyOutflowCents,
          correlationId: ctx.correlationId ?? detail.correlation_id,
        },
        "situation computed",
      );
    },
  };
}
