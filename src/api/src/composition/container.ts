import {
  type Config,
  type Db,
  type Logger,
  createAwsClients,
} from "@penny/core";
import {
  HouseholdStatusService,
  InterpretTriggerService,
  MemoryCommandService,
  PlaidLinkService,
  SessionService,
  SituationQueryService,
  type ApiServices,
} from "../services/index.js";

export function createApiServices(deps: {
  config: Config;
  pool: Db;
  log: Logger;
}): ApiServices {
  const aws = createAwsClients(deps.config);
  const interpret = new InterpretTriggerService(deps.config, aws);

  return {
    session: new SessionService(deps.pool),
    plaidLink: new PlaidLinkService(deps.config, deps.pool, aws, deps.log),
    householdStatus: new HouseholdStatusService(deps.pool),
    situation: new SituationQueryService(deps.pool),
    memory: new MemoryCommandService(deps.pool, interpret),
    interpret,
  };
}
