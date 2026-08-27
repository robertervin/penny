import {
  type AwsClients,
  type Config,
  publishHouseholdInterpretRequested,
} from "@penny/core";

export type InterpretTrigger = "manual" | "correction";

export class InterpretTriggerService {
  constructor(
    private readonly config: Config,
    private readonly aws: AwsClients,
  ) {}

  async trigger(opts: {
    personId: string;
    householdId: string;
    trigger: InterpretTrigger;
  }) {
    return publishHouseholdInterpretRequested({
      config: this.config,
      clients: this.aws,
      personId: opts.personId,
      householdId: opts.householdId,
      trigger: opts.trigger,
    });
  }

  async maybeTrigger(opts: {
    personId: string;
    householdId: string;
    trigger: InterpretTrigger;
    enabled?: boolean;
  }) {
    if (opts.enabled === false) {
      return undefined;
    }

    const result = await this.trigger({
      personId: opts.personId,
      householdId: opts.householdId,
      trigger: opts.trigger,
    });

    return result.eventId;
  }
}
