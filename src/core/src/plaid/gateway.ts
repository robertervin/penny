import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import type { Config } from "../config/env.js";
import { PermanentWorkflowError, RetryableWorkflowError } from "../events/envelope.js";

export type PlaidAccountSnapshot = {
  account_id: string;
  name: string;
  official_name: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string | null;
  };
};

export type PlaidTxn = {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  date: string;
  datetime: string | null;
  pending: boolean;
  pending_transaction_id: string | null;
  name: string;
  merchant_name: string | null;
  payment_channel: string | null;
};

export type TransactionsSyncResult = {
  added: PlaidTxn[];
  modified: PlaidTxn[];
  removed: Array<{ transaction_id: string }>;
  next_cursor: string;
  has_more: boolean;
  request_id?: string;
};

export interface PlaidGateway {
  syncTransactions(accessToken: string, cursor: string | null): Promise<TransactionsSyncResult>;
  getBalances(accessToken: string): Promise<PlaidAccountSnapshot[]>;
}

function mapTxn(t: {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code?: string | null;
  date: string;
  datetime?: string | null;
  pending: boolean;
  pending_transaction_id?: string | null;
  name: string;
  merchant_name?: string | null;
  payment_channel?: string | null;
}): PlaidTxn {
  return {
    transaction_id: t.transaction_id,
    account_id: t.account_id,
    amount: t.amount,
    iso_currency_code: t.iso_currency_code ?? "USD",
    date: t.date,
    datetime: t.datetime ?? null,
    pending: t.pending,
    pending_transaction_id: t.pending_transaction_id ?? null,
    name: t.name,
    merchant_name: t.merchant_name ?? null,
    payment_channel: t.payment_channel ?? null,
  };
}

export class LivePlaidGateway implements PlaidGateway {
  private readonly client: PlaidApi;

  constructor(config: Config) {
    if (!config.plaidClientId || !config.plaidSecret) {
      throw new Error("PLAID_CLIENT_ID and PLAID_SECRET are required when PLAID_STUB is false");
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
    this.client = new PlaidApi(configuration);
  }

  async syncTransactions(accessToken: string, cursor: string | null): Promise<TransactionsSyncResult> {
    try {
      const added: PlaidTxn[] = [];
      const modified: PlaidTxn[] = [];
      const removed: Array<{ transaction_id: string }> = [];
      let nextCursor = cursor ?? "";
      let hasMore = true;
      let requestId: string | undefined;

      while (hasMore) {
        const response = await this.client.transactionsSync({
          access_token: accessToken,
          cursor: nextCursor || undefined,
        });
        const data = response.data;
        requestId = data.request_id;
        added.push(...data.added.map(mapTxn));
        modified.push(...data.modified.map(mapTxn));
        removed.push(
          ...data.removed.map((r) => ({ transaction_id: r.transaction_id ?? "" })).filter((r) => r.transaction_id),
        );
        nextCursor = data.next_cursor;
        hasMore = data.has_more;
      }

      return {
        added,
        modified,
        removed,
        next_cursor: nextCursor,
        has_more: false,
        request_id: requestId,
      };
    } catch (err) {
      throw mapPlaidError(err);
    }
  }

  async getBalances(accessToken: string): Promise<PlaidAccountSnapshot[]> {
    try {
      const response = await this.client.accountsBalanceGet({ access_token: accessToken });
      return response.data.accounts.map((a) => ({
        account_id: a.account_id,
        name: a.name,
        official_name: a.official_name ?? null,
        mask: a.mask ?? null,
        type: String(a.type),
        subtype: a.subtype ? String(a.subtype) : null,
        balances: {
          available: a.balances.available ?? null,
          current: a.balances.current ?? null,
          limit: a.balances.limit ?? null,
          iso_currency_code: a.balances.iso_currency_code ?? "USD",
        },
      }));
    } catch (err) {
      throw mapPlaidError(err);
    }
  }
}

/** Deterministic stub for local/dev without Plaid credentials. */
export class StubPlaidGateway implements PlaidGateway {
  async syncTransactions(accessToken: string, cursor: string | null): Promise<TransactionsSyncResult> {
    const accountId = `stub-acct-${accessToken.slice(-6) || "default"}`;
    if (cursor) {
      return {
        added: [],
        modified: [],
        removed: [],
        next_cursor: cursor,
        has_more: false,
        request_id: "stub-incremental",
      };
    }
    const today = new Date().toISOString().slice(0, 10);
    return {
      added: [
        {
          transaction_id: `stub-txn-1-${accountId}`,
          account_id: accountId,
          amount: 12.34,
          iso_currency_code: "USD",
          date: today,
          datetime: null,
          pending: false,
          pending_transaction_id: null,
          name: "STUB COFFEE SHOP",
          merchant_name: "Stub Coffee",
          payment_channel: "in store",
        },
        {
          transaction_id: `stub-txn-2-${accountId}`,
          account_id: accountId,
          amount: -2500,
          iso_currency_code: "USD",
          date: today,
          datetime: null,
          pending: false,
          pending_transaction_id: null,
          name: "STUB PAYROLL",
          merchant_name: null,
          payment_channel: "other",
        },
      ],
      modified: [],
      removed: [],
      next_cursor: `stub-cursor-${accountId}`,
      has_more: false,
      request_id: "stub-initial",
    };
  }

  async getBalances(accessToken: string): Promise<PlaidAccountSnapshot[]> {
    const accountId = `stub-acct-${accessToken.slice(-6) || "default"}`;
    return [
      {
        account_id: accountId,
        name: "Stub Checking",
        official_name: "Stub Checking Account",
        mask: "0000",
        type: "depository",
        subtype: "checking",
        balances: {
          available: 1250.5,
          current: 1300.0,
          limit: null,
          iso_currency_code: "USD",
        },
      },
    ];
  }
}

export function createPlaidGateway(config: Config): PlaidGateway {
  if (config.plaidStub) return new StubPlaidGateway();
  return new LivePlaidGateway(config);
}

function mapPlaidError(err: unknown): Error {
  const anyErr = err as {
    response?: { data?: { error_code?: string; error_message?: string }; status?: number };
    message?: string;
  };
  const code = anyErr.response?.data?.error_code;
  const message = anyErr.response?.data?.error_message ?? anyErr.message ?? "Plaid error";

  if (
    code === "ITEM_LOGIN_REQUIRED" ||
    code === "INVALID_ACCESS_TOKEN" ||
    code === "ITEM_NOT_FOUND"
  ) {
    return new PermanentWorkflowError(`Plaid ${code}: ${message}`);
  }
  if (code === "RATE_LIMIT_EXCEEDED" || (anyErr.response?.status ?? 0) >= 500) {
    return new RetryableWorkflowError(`Plaid ${code ?? "5xx"}: ${message}`);
  }
  return new RetryableWorkflowError(`Plaid error: ${message}`);
}

// Re-export types used by API helpers later
export { Products, CountryCode };
