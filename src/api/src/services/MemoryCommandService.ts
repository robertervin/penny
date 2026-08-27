import {
  type Db,
  deactivateMemoryRule,
  getLastUndoableCorrection,
  insertCorrection,
  insertMemoryRule,
  listMemoryRules,
  markCorrectionUndone,
  type MemoryAction,
} from "@penny/core";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { toMemoryRuleDto, toMemoryRuleSummaryDto } from "../mappers/memoryRule.js";
import { InterpretTriggerService } from "./InterpretTriggerService.js";

export class MemoryCommandService {
  constructor(
    private readonly pool: Db,
    private readonly interpret: InterpretTriggerService,
  ) {}

  async listRules(householdId: string) {
    const rules = await listMemoryRules(this.pool, householdId);
    return { rules: rules.map(toMemoryRuleDto) };
  }

  async createRule(input: {
    householdId: string;
    personId: string;
    matchField?: "raw_name" | "merchant_name" | "either";
    matchPattern: string;
    accountId?: string | null;
    action: MemoryAction;
    note?: string;
    sourceChannel?: string;
    triggerInterpret?: boolean;
  }) {
    const channel = input.sourceChannel ?? "api";

    const rule = await insertMemoryRule(this.pool, {
      householdId: input.householdId,
      matchField: input.matchField,
      matchPattern: input.matchPattern,
      accountId: input.accountId,
      action: input.action,
      sourceChannel: channel,
      createdBy: input.personId,
      note: input.note,
    });

    await insertCorrection(this.pool, {
      householdId: input.householdId,
      personId: input.personId,
      channel,
      parsedIntent: {
        type: "create_memory_rule",
        matchPattern: rule.match_pattern,
        action: rule.action,
      },
      ruleId: rule.id,
    });

    const interpretEventId = await this.interpret.maybeTrigger({
      personId: input.personId,
      householdId: input.householdId,
      trigger: "correction",
      enabled: input.triggerInterpret,
    });

    return {
      rule: toMemoryRuleSummaryDto(rule),
      interpret_event_id: interpretEventId,
    };
  }

  async updateRule(input: {
    householdId: string;
    ruleId: string;
    personId: string;
    active: boolean;
    triggerInterpret?: boolean;
  }) {
    if (input.active) {
      throw new ValidationError("Only deactivation supported in v1");
    }

    const ok = await deactivateMemoryRule(this.pool, input.householdId, input.ruleId);
    if (!ok) {
      throw new NotFoundError("Rule not found or already inactive");
    }

    await insertCorrection(this.pool, {
      householdId: input.householdId,
      personId: input.personId,
      channel: "api",
      parsedIntent: { type: "deactivate_memory_rule", ruleId: input.ruleId },
      ruleId: input.ruleId,
    });

    const interpretEventId = await this.interpret.maybeTrigger({
      personId: input.personId,
      householdId: input.householdId,
      trigger: "correction",
      enabled: input.triggerInterpret,
    });

    return { ok: true as const, interpret_event_id: interpretEventId };
  }

  async undoLastCorrection(input: {
    householdId: string;
    personId: string;
    triggerInterpret?: boolean;
  }) {
    const correction = await getLastUndoableCorrection(this.pool, input.householdId);
    if (!correction?.rule_id) {
      throw new NotFoundError("Nothing to undo");
    }

    const ok = await deactivateMemoryRule(this.pool, input.householdId, correction.rule_id);
    if (!ok) {
      throw new ConflictError("Associated rule could not be deactivated");
    }

    await markCorrectionUndone(this.pool, correction.id);

    const interpretEventId = await this.interpret.maybeTrigger({
      personId: input.personId,
      householdId: input.householdId,
      trigger: "correction",
      enabled: input.triggerInterpret,
    });

    return {
      undone_correction_id: correction.id,
      deactivated_rule_id: correction.rule_id,
      interpret_event_id: interpretEventId,
    };
  }
}
