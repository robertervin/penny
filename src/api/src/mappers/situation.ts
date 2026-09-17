import type { SituationRow } from "@penny/core";

export function toSituationDto(situation: SituationRow) {
  return {
    householdId: situation.household_id,
    version: situation.version,
    computedAt: situation.computed_at,
    runwayMonths: situation.runway_months !== null ? Number(situation.runway_months) : null,
    operatingRunwayMonths:
      situation.operating_runway_months !== null
        ? Number(situation.operating_runway_months)
        : null,
    liquidCents: situation.liquid_cents !== null ? Number(situation.liquid_cents) : null,
    monthlyOutflowCents:
      situation.monthly_outflow_cents !== null ? Number(situation.monthly_outflow_cents) : null,
    monthlyOperatingOutflowCents:
      situation.monthly_operating_outflow_cents !== null
        ? Number(situation.monthly_operating_outflow_cents)
        : null,
    monthlyInflowCents:
      situation.monthly_inflow_cents !== null ? Number(situation.monthly_inflow_cents) : null,
    monthlyPayrollInflowCents:
      situation.monthly_payroll_inflow_cents !== null
        ? Number(situation.monthly_payroll_inflow_cents)
        : null,
    debtPosture: situation.debt_posture,
    incomeShape: situation.income_shape,
    liquidityMap: situation.liquidity_map,
    classified: situation.classified,
    meta: situation.meta,
  };
}
