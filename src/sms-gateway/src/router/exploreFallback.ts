import type { PennyApiClient } from "@penny/api-client";
import { formatBreakdownSummary, truncateSms } from "../format/sms.js";

type SituationDto = {
  runwayMonths?: number | null;
  operatingRunwayMonths?: number | null;
  liquidCents?: number | null;
  monthlyInflowCents?: number | null;
  monthlyPayrollInflowCents?: number | null;
  monthlyOutflowCents?: number | null;
  monthlyOperatingOutflowCents?: number | null;
  debtPosture?: unknown;
};

function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "n/a";
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo`;
}

function formatDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "n/a";
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export async function tryExploreWithoutLlm(
  client: PennyApiClient,
  householdId: string,
  message: string,
): Promise<string | null> {
  const text = message.trim().toLowerCase();

  if (/\b(income|inflow|payroll|pay\s*check|salary)\b/.test(text)) {
    try {
      const situation = (await client.getSituation(householdId)) as SituationDto;
      const payroll = situation.monthlyPayrollInflowCents;
      const total = situation.monthlyInflowCents;
      const primary = payroll ?? total;
      return truncateSms(
        [
          `Income (90d avg): ${formatCents(primary)}`,
          payroll !== null && payroll !== undefined && total !== payroll
            ? `Total inflow: ${formatCents(total)}`
            : null,
          "",
          "Reply WHY income for line items.",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch {
      try {
        const breakdown = (await client.getSituationBreakdown(householdId, {
          bucket: "income",
          limit: 5,
        })) as Parameters<typeof formatBreakdownSummary>[0];
        if ((breakdown.transactions?.length ?? 0) > 0) {
          return formatBreakdownSummary(breakdown, "income");
        }
      } catch {
        // fall through
      }
      return truncateSms(
        "No income data yet. Connect accounts at Link UI (port 5174), wait for sync, then try WHY income.",
      );
    }
  }

  if (/\b(runway|how\s+long|months?\s+of\s+cash)\b/.test(text)) {
    try {
      const situation = (await client.getSituation(householdId)) as SituationDto;
      const operating = situation.operatingRunwayMonths ?? situation.runwayMonths;
      return truncateSms(
        [
          `Operating runway: ${operating !== null && operating !== undefined ? `${operating.toFixed(1)} months` : "n/a"}`,
          `Liquid: ${formatDollars(situation.liquidCents)}`,
          `Operating outflow: ${formatCents(situation.monthlyOperatingOutflowCents ?? situation.monthlyOutflowCents)}`,
          "",
          "Reply WHY bills for spending breakdown.",
        ].join("\n"),
      );
    } catch {
      return truncateSms(
        "Situation not computed yet. Connect accounts in Link UI (port 5174), then wait for sync + interpret.",
      );
    }
  }

  if (/\b(bills|spending|outflow|expenses?)\b/.test(text)) {
    const breakdown = (await client.getSituationBreakdown(householdId, {
      bucket: "operating_outflow",
      limit: 5,
    })) as Parameters<typeof formatBreakdownSummary>[0];
    return formatBreakdownSummary(breakdown, "operating_outflow");
  }

  if (/\b(status|accounts|linked|balance)\b/.test(text)) {
    const status = (await client.getHouseholdStatus(householdId)) as {
      items?: unknown[];
      ledger?: { accounts?: number; transactions?: number };
      situation?: SituationDto | null;
    };
    const items = status.items?.length ?? 0;
    const accounts = status.ledger?.accounts ?? 0;
    const txns = status.ledger?.transactions ?? 0;
    return truncateSms(
      [
        `Linked institutions: ${items}`,
        `Ledger: ${accounts} accounts, ${txns} transactions`,
        status.situation
          ? `Runway: ${status.situation.operatingRunwayMonths ?? status.situation.runwayMonths ?? "n/a"} mo`
          : "Situation: not computed yet",
      ].join("\n"),
    );
  }

  return null;
}

export function formatLlmError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("insufficient_quota") || message.includes("429")) {
    return truncateSms(
      "Explore AI is unavailable (OpenAI credits exhausted). Try keyword commands: WHY income, WHY bills, RULES, HELP — those work without AI.",
    );
  }
  if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
    return truncateSms(
      "Penny API unreachable. Make sure npm run api:dev and npm run sms:dev are running.",
    );
  }
  return truncateSms(`Something went wrong: ${message.slice(0, 200)}`);
}
