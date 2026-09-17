import type { MemoryRuleRow } from "@penny/core";

export function toMemoryRuleDto(rule: MemoryRuleRow) {
  return {
    id: rule.id,
    matchField: rule.match_field,
    matchPattern: rule.match_pattern,
    accountId: rule.account_id,
    action: rule.action,
    note: rule.note,
    active: rule.active,
    sourceChannel: rule.source_channel,
    createdAt: rule.created_at,
  };
}

export function toMemoryRuleSummaryDto(rule: MemoryRuleRow) {
  return {
    id: rule.id,
    matchField: rule.match_field,
    matchPattern: rule.match_pattern,
    action: rule.action,
    note: rule.note,
  };
}
