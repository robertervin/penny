import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import type { Config } from "../config/env.js";

export function createPlaidApi(config: Config): PlaidApi {
  if (config.plaidStub || !config.plaidClientId || !config.plaidSecret) {
    throw new Error("Plaid API requires PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_STUB=false");
  }
  const configuration = new Configuration({
    basePath: PlaidEnvironments[config.plaidEnv],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": config.plaidClientId,
        "PLAID-SECRET": config.plaidSecret,
      },
    },
  });
  return new PlaidApi(configuration);
}

export { Products, CountryCode };
