import {
  type Db,
  countLedgerForHousehold,
  getSituation,
  listPlaidItemsForHousehold,
} from "@penny/core";
import { toSituationDto } from "../mappers/situation.js";

export class HouseholdStatusService {
  constructor(private readonly pool: Db) {}

  async getStatus(householdId: string) {
    const [items, ledger, situation] = await Promise.all([
      listPlaidItemsForHousehold(this.pool, householdId),
      countLedgerForHousehold(this.pool, householdId),
      getSituation(this.pool, householdId),
    ]);

    return {
      items,
      ledger,
      situation: situation ? toSituationDto(situation) : null,
    };
  }
}
