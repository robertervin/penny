const PHONE_KEY = "penny-mfb-phone";
const DEFAULT_PHONE = "+15555550100";

export function getMfbPhone(): string {
  if (typeof localStorage === "undefined") return DEFAULT_PHONE;
  return localStorage.getItem(PHONE_KEY) ?? DEFAULT_PHONE;
}

export function setMfbPhone(phone: string): void {
  localStorage.setItem(PHONE_KEY, phone);
}

export type PennySmsResponse = {
  to: string;
  body: string;
};

export async function sendPennyMessage(body: string): Promise<PennySmsResponse> {
  const res = await fetch("/sms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from: getMfbPhone(), body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Penny SMS gateway ${res.status}: ${text}`);
  }

  return res.json() as Promise<PennySmsResponse>;
}

export async function checkPennyHealth(): Promise<boolean> {
  try {
    const res = await fetch("/sms-health");
    return res.ok;
  } catch {
    return false;
  }
}

/** Show YES/NO quick replies when Penny is waiting for confirmation. */
export function suggestsConfirmation(text: string): boolean {
  return /reply\s+yes\s*\/\s*no/i.test(text) || /apply to last 90 days/i.test(text);
}
