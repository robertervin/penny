import { type Db, getOrCreateLocalHousehold } from "@penny/core";

export class SessionService {
  constructor(private readonly pool: Db) {}

  bootstrap() {
    return getOrCreateLocalHousehold(this.pool);
  }
}
