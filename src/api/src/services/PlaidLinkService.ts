import {
  type AwsClients,
  type Config,
  type Db,
  type Logger,
  TokenVault,
  insertPlaidItem,
  publishPlaidSyncRequested,
  createPlaidApi,
} from "@penny/core";
import { CountryCode, Products } from "plaid";

export class PlaidLinkService {
  private readonly vault: TokenVault;

  constructor(
    private readonly config: Config,
    private readonly pool: Db,
    private readonly aws: AwsClients,
    private readonly log: Logger,
  ) {
    this.vault = new TokenVault(config.tokenEncryptionKey);
  }

  async createLinkToken(personId: string) {
    const plaid = createPlaidApi(this.config);
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: personId },
      client_name: "Penny",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return {
      link_token: response.data.link_token,
      expiration: response.data.expiration,
    };
  }

  async exchangePublicToken(input: {
    publicToken: string;
    personId: string;
    householdId: string;
    institution?: {
      institution_id?: string;
      name?: string;
    };
  }) {
    const plaid = createPlaidApi(this.config);
    const exchange = await plaid.itemPublicTokenExchange({
      public_token: input.publicToken,
    });

    const accessToken = exchange.data.access_token;
    const plaidItemExternalId = exchange.data.item_id;

    let institutionId = input.institution?.institution_id ?? null;
    let institutionName = input.institution?.name ?? null;

    try {
      const item = await plaid.itemGet({ access_token: accessToken });
      institutionId = item.data.item.institution_id ?? institutionId;
    } catch (err) {
      this.log.warn({ err }, "itemGet failed after exchange");
    }

    const { itemId } = await insertPlaidItem(this.pool, {
      householdId: input.householdId,
      personId: input.personId,
      plaidItemExternalId,
      accessTokenEncrypted: this.vault.encrypt(accessToken),
      institutionId,
      institutionName,
    });

    const { eventId } = await publishPlaidSyncRequested({
      config: this.config,
      clients: this.aws,
      personId: input.personId,
      householdId: input.householdId,
      plaidItemId: itemId,
      mode: "initial_backfill",
      reason: "link",
    });

    this.log.info({ itemId, plaidItemExternalId, eventId }, "plaid item linked; sync requested");

    return {
      item_id: itemId,
      plaid_item_id: plaidItemExternalId,
      institution_id: institutionId,
      institution_name: institutionName,
      sync_event_id: eventId,
    };
  }
}
