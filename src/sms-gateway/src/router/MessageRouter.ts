import { PennyApiClient, type ProposedMemoryRule } from "@penny/api-client";
import {
  createOpenAiLlm,
  createPennyTools,
  runAgentTurn,
  type AgentMessage,
  type LlmClient,
} from "@penny/agent";
import {
  bindPhoneToPerson,
  clearThreadState,
  getThreadSession,
  resolveHouseholdByPhone,
  upsertThreadSession,
  type Db,
} from "@penny/core";
import type { Config } from "../config/env.js";
import { formatBreakdownSummary, formatHelp, formatProposal, truncateSms } from "../format/sms.js";
import { parseKeywordMessage } from "../parse/keywords.js";
import { formatLlmError, tryExploreWithoutLlm } from "./exploreFallback.js";

export type InboundMessage = {
  from: string;
  body: string;
};

export type OutboundMessage = {
  to: string;
  body: string;
};

type ThreadState = {
  awaiting?: "confirm";
  pendingProposal?: ProposedMemoryRule[];
};

const CHANNEL = "sms";

export class MessageRouter {
  private readonly client: PennyApiClient;
  private readonly tools: ReturnType<typeof createPennyTools>;
  private readonly llm: LlmClient | null;

  constructor(
    private readonly pool: Db,
    private readonly config: Config,
  ) {
    this.client = new PennyApiClient(config.pennyApiUrl);
    this.tools = createPennyTools(this.client, { channel: "sms" });
    this.llm = config.openAiApiKey
      ? createOpenAiLlm({
          apiKey: config.openAiApiKey,
          baseUrl: config.openAiBaseUrl,
        })
      : null;
  }

  async handle(msg: InboundMessage): Promise<OutboundMessage> {
    const phone = normalizePhone(msg.from);
    const identity = await this.resolveIdentity(phone);
    if (!identity) {
      return {
        to: phone,
        body: "Penny: phone not linked. Set PENNY_DEV_* env and bind your number, or use Link UI first.",
      };
    }

    let thread = await getThreadSession(this.pool, CHANNEL, phone);
    if (!thread) {
      thread = await upsertThreadSession(this.pool, {
        channel: CHANNEL,
        externalThreadId: phone,
        householdId: identity.householdId,
        personId: identity.personId,
        messages: [],
        state: {},
      });
    }

    const state = thread.state as ThreadState;
    const keyword = parseKeywordMessage(msg.body);

    if (state.awaiting === "confirm" && keyword.type === "confirm") {
      const reply = await this.handleConfirm(keyword.answer, identity, state, phone);
      return { to: phone, body: reply };
    }

    if (keyword.type === "help") {
      return { to: phone, body: formatHelp() };
    }

    if (keyword.type === "undo") {
      const result = await this.client.undoCorrection(identity.householdId, {
        person_id: identity.personId,
      });
      await clearThreadState(this.pool, CHANNEL, phone);
      return { to: phone, body: truncateSms(`Undone. ${JSON.stringify(result)}`) };
    }

    if (keyword.type === "rules") {
      const { rules } = await this.client.listMemoryRules(identity.householdId);
      const lines = (rules as Array<{ matchPattern: string; action: string; active: boolean }>).map(
        (r, i) => `${i + 1}. ${r.matchPattern} → ${r.action}${r.active ? "" : " (inactive)"}`,
      );
      return { to: phone, body: truncateSms(["Memory rules:", ...lines].join("\n") || "No rules yet.") };
    }

    if (keyword.type === "done") {
      await clearThreadState(this.pool, CHANNEL, phone);
      return { to: phone, body: "Done. Text anytime to explore your finances." };
    }

    if (keyword.type === "why") {
      const breakdown = (await this.client.getSituationBreakdown(identity.householdId, {
        bucket: keyword.bucket,
        limit: 5,
      })) as Parameters<typeof formatBreakdownSummary>[0];
      return { to: phone, body: formatBreakdownSummary(breakdown, keyword.bucket) };
    }

    const exploreReply = await tryExploreWithoutLlm(
      this.client,
      identity.householdId,
      msg.body,
    );
    if (exploreReply) {
      return { to: phone, body: exploreReply };
    }

    if (!this.llm) {
      return {
        to: phone,
        body: "Penny: set OPENAI_API_KEY for explore mode. Try WHY income, RULES, or HELP.",
      };
    }

    const history = (thread.messages as AgentMessage[]).slice(-12);
    try {
      const turn = await runAgentTurn({
        llm: this.llm,
        model: this.config.openAiModel,
        tools: this.tools.definitions,
        context: {
          householdId: identity.householdId,
          personId: identity.personId,
          channel: "sms",
        },
        messages: history,
        userMessage: msg.body,
        interceptWrites: true,
        maxToolRounds: 3,
      });

      const newState: ThreadState = { ...state };
      let reply = turn.reply;

      if (turn.pendingProposal?.length) {
        newState.awaiting = "confirm";
        newState.pendingProposal = turn.pendingProposal;
        reply = formatProposal(turn.pendingProposal);
      } else {
        delete newState.awaiting;
        delete newState.pendingProposal;
      }

      await upsertThreadSession(this.pool, {
        channel: CHANNEL,
        externalThreadId: phone,
        householdId: identity.householdId,
        personId: identity.personId,
        mode: "explore",
        state: newState,
        messages: turn.messages.slice(-20),
      });

      return { to: phone, body: truncateSms(reply) };
    } catch (err) {
      const fallback = await tryExploreWithoutLlm(this.client, identity.householdId, msg.body);
      if (fallback) {
        return { to: phone, body: fallback };
      }
      return { to: phone, body: formatLlmError(err) };
    }
  }

  private async handleConfirm(
    answer: "yes" | "no" | "edit",
    identity: { householdId: string; personId: string },
    state: ThreadState,
    phone: string,
  ): Promise<string> {
    if (answer === "no") {
      await clearThreadState(this.pool, CHANNEL, phone);
      return "Cancelled. No changes made.";
    }

    if (answer === "edit") {
      await upsertThreadSession(this.pool, {
        channel: CHANNEL,
        externalThreadId: phone,
        householdId: identity.householdId,
        personId: identity.personId,
        state: { awaiting: undefined, pendingProposal: state.pendingProposal },
        messages: [],
      });
      return "What should I change? Describe the rules you want.";
    }

    const rules = state.pendingProposal ?? [];
    if (rules.length === 0) {
      await clearThreadState(this.pool, CHANNEL, phone);
      return "Nothing pending to apply.";
    }

    for (const rule of rules) {
      await this.client.createMemoryRule(identity.householdId, {
        person_id: identity.personId,
        match_pattern: rule.matchPattern,
        action: rule.action,
        match_field: rule.matchField,
        note: rule.note,
        source_channel: "sms",
        trigger_interpret: false,
      });
    }

    await this.client.triggerInterpret(identity.householdId, { person_id: identity.personId });
    await clearThreadState(this.pool, CHANNEL, phone);

    try {
      const situation = (await this.client.getSituation(identity.householdId)) as {
        monthlyInflowCents?: number | null;
        monthlyPayrollInflowCents?: number | null;
        operatingRunwayMonths?: number | null;
      };
      const income = situation.monthlyPayrollInflowCents ?? situation.monthlyInflowCents;
      const incomeStr = income
        ? `$${(income / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}/mo`
        : "updated";
      const runway =
        situation.operatingRunwayMonths !== null && situation.operatingRunwayMonths !== undefined
          ? `${situation.operatingRunwayMonths.toFixed(1)} mo operating runway`
          : "";
      return truncateSms(`Applied ${rules.length} rule(s). Income ~${incomeStr}. ${runway}\nReply UNDO to revert.`);
    } catch {
      return `Applied ${rules.length} rule(s). Situation is recomputing — text WHY income in a moment.`;
    }
  }

  private async resolveIdentity(phone: string) {
    const existing = await resolveHouseholdByPhone(this.pool, phone);
    if (existing) {
      return { personId: existing.person_id, householdId: existing.household_id };
    }

    if (this.config.devHouseholdId && this.config.devPersonId) {
      await bindPhoneToPerson(this.pool, this.config.devPersonId, phone);
      return {
        personId: this.config.devPersonId,
        householdId: this.config.devHouseholdId,
      };
    }

    if (this.config.devMode) {
      const session = await this.client.bootstrapSession();
      await bindPhoneToPerson(this.pool, session.personId, phone);
      return { personId: session.personId, householdId: session.householdId };
    }

    return null;
  }
}

function normalizePhone(from: string): string {
  const digits = from.replace(/\D/g, "");
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return from.startsWith("+") ? from : `+${digits}`;
}
