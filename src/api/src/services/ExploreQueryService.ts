import { type Db, executeExploreQuery, type ExploreQuery } from "@penny/core";

export class ExploreQueryService {
  constructor(private readonly pool: Db) {}

  runQuery(householdId: string, query: ExploreQuery) {
    return executeExploreQuery(this.pool, householdId, query);
  }
}
