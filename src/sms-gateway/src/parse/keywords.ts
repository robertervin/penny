export type KeywordResult =
  | { type: "help" }
  | { type: "undo" }
  | { type: "rules" }
  | { type: "done" }
  | { type: "why"; bucket: string }
  | { type: "confirm"; answer: "yes" | "no" | "edit" }
  | { type: "none" };

const WHY_BUCKETS: Record<string, string> = {
  income: "income",
  payroll: "payroll",
  bills: "operating_outflow",
  outflow: "outflow",
  runway: "income",
  debt: "debt_service",
};

export function parseKeywordMessage(body: string): KeywordResult {
  const text = body.trim();
  const upper = text.toUpperCase();

  if (upper === "HELP" || upper === "?") return { type: "help" };
  if (upper === "UNDO") return { type: "undo" };
  if (upper === "RULES") return { type: "rules" };
  if (upper === "DONE") return { type: "done" };
  if (upper === "YES" || upper === "Y") return { type: "confirm", answer: "yes" };
  if (upper === "NO" || upper === "N") return { type: "confirm", answer: "no" };
  if (upper === "EDIT") return { type: "confirm", answer: "edit" };

  const whyMatch = upper.match(/^WHY\s+(\w+)/);
  if (whyMatch) {
    const key = whyMatch[1]!.toLowerCase();
    const bucket = WHY_BUCKETS[key] ?? key;
    return { type: "why", bucket };
  }

  return { type: "none" };
}
