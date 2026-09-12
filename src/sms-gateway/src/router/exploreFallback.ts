export function formatLlmError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("insufficient_quota") || message.includes("429")) {
    return truncateSms(
      "Explore AI is unavailable (OpenAI credits exhausted). Try keyword commands: WHY income, WHY bills, RULES, HELP.",
    );
  }
  if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
    return truncateSms(
      "Penny API unreachable. Make sure npm run api:dev and npm run sms:dev are running.",
    );
  }
  return truncateSms(`Something went wrong: ${message.slice(0, 200)}`);
}

function truncateSms(text: string, max = 1500): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 20)}\n\n(reply MORE)`;
}
