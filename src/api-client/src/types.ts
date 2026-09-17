export type MemoryAction = "ignore" | "payroll" | "transfer" | "debt_service";

export type BootstrapSession = {
  personId: string;
  householdId: string;
};

export type CreateMemoryRuleInput = {
  person_id: string;
  match_field?: "raw_name" | "merchant_name" | "either";
  match_pattern: string;
  account_id?: string | null;
  action: MemoryAction;
  note?: string;
  source_channel?: string;
  trigger_interpret?: boolean;
};

export type ProposedMemoryRule = {
  matchPattern: string;
  action: MemoryAction;
  matchField?: "raw_name" | "merchant_name" | "either";
  note?: string;
};
