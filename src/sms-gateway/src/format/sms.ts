import type { ProposedMemoryRule } from "@penny/api-client";

export function truncateSms(text: string, max = 1500): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 20)}\n\n(reply MORE)`;
}

export function formatHelp(): string {
  return [
    "Penny SMS commands:",
    "• Ask anything about your finances",
    "• WHY income / WHY bills / WHY debt",
    "• RULES — list memory rules",
    "• UNDO — revert last correction",
    "• YES / NO — confirm proposed rules",
    "• HELP",
  ].join("\n");
}

export function formatProposal(rules: ProposedMemoryRule[]): string {
  const lines = rules.map((r) => `• "${r.matchPattern}" → ${r.action}`);
  return truncateSms(
    `I'll save:\n${lines.join("\n")}\nApply to last 90 days? Reply YES / NO`,
  );
}

export function formatBreakdownSummary(
  breakdown: {
    bucket: string;
    monthlyEstimateCents?: number;
    transactions?: Array<{ label?: string; amountCents?: number }>;
  },
  bucket: string,
): string {
  const txns = breakdown.transactions ?? [];
  if (txns.length === 0) {
    return truncateSms(
      `No ${bucket} transactions in the last 90 days.\n\nConnect accounts at Link UI (port 5174), wait for sync + interpret, then try again.`,
    );
  }

  const monthly = breakdown.monthlyEstimateCents
    ? `$${(breakdown.monthlyEstimateCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo`
    : "n/a";

  const lines = txns.slice(0, 5).map((t, i) => {
    const amt = t.amountCents
      ? `$${(Math.abs(t.amountCents) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : "?";
    return `${i + 1}. ${t.label ?? "Unknown"} — ${amt}`;
  });

  return truncateSms(
    [`${bucket} ~${monthly} (90d avg). Top lines:`, ...lines, "", 'Reply naturally to fix, or "IGNORE those".'].join(
      "\n",
    ),
  );
}
