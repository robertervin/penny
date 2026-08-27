import type { CreateMemoryRuleInput } from "./types.js";

export class PennyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "PennyApiError";
  }
}

export class PennyApiClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    const text = await res.text();
    const body = text ? (JSON.parse(text) as unknown) : undefined;

    if (!res.ok) {
      const message =
        typeof body === "object" && body !== null && "error" in body
          ? String((body as { error: string }).error)
          : `Penny API ${res.status}`;
      throw new PennyApiError(message, res.status, body);
    }

    return body as T;
  }

  bootstrapSession() {
    return this.request<{ personId: string; householdId: string }>("/api/session/bootstrap", {
      method: "POST",
      body: "{}",
    });
  }

  getHouseholdStatus(householdId: string) {
    return this.request<unknown>(`/api/household/${householdId}/status`);
  }

  getSituation(householdId: string) {
    return this.request<unknown>(`/api/household/${householdId}/situation`);
  }

  getSituationBreakdown(
    householdId: string,
    opts: { bucket?: string; limit?: number; offset?: number } = {},
  ) {
    const params = new URLSearchParams();
    if (opts.bucket) params.set("bucket", opts.bucket);
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts.offset !== undefined) params.set("offset", String(opts.offset));
    const qs = params.toString();
    return this.request<unknown>(
      `/api/household/${householdId}/situation/breakdown${qs ? `?${qs}` : ""}`,
    );
  }

  listMemoryRules(householdId: string) {
    return this.request<{ rules: unknown[] }>(`/api/household/${householdId}/memory/rules`);
  }

  createMemoryRule(householdId: string, input: CreateMemoryRuleInput) {
    return this.request<unknown>(`/api/household/${householdId}/memory/rules`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  deactivateMemoryRule(
    householdId: string,
    ruleId: string,
    input: { person_id: string; active: false; trigger_interpret?: boolean },
  ) {
    return this.request<unknown>(`/api/household/${householdId}/memory/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  undoCorrection(
    householdId: string,
    input: { person_id: string; trigger_interpret?: boolean },
  ) {
    return this.request<unknown>(`/api/household/${householdId}/corrections/undo`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  triggerInterpret(householdId: string, input: { person_id: string }) {
    return this.request<{ event_id: string }>(`/api/household/${householdId}/interpret`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
