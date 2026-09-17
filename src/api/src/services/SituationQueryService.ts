import {
  type Db,
  getSituation,
  getSituationBreakdownForHousehold,
  VALID_BREAKDOWN_BUCKETS,
} from "@penny/core";
import { NotFoundError, ValidationError } from "../errors.js";
import { toSituationDto } from "../mappers/situation.js";

export class SituationQueryService {
  constructor(private readonly pool: Db) {}

  async getSituation(householdId: string) {
    const situation = await getSituation(this.pool, householdId);
    if (!situation) {
      throw new NotFoundError("Situation not computed yet");
    }

    return toSituationDto(situation);
  }

  async getBreakdown(
    householdId: string,
    opts: { bucket: string; limit: number; offset: number },
  ) {
    const breakdown = await getSituationBreakdownForHousehold(this.pool, householdId, opts);
    if (!breakdown) {
      throw new ValidationError("Invalid bucket", { validBuckets: VALID_BREAKDOWN_BUCKETS });
    }

    return breakdown;
  }
}
