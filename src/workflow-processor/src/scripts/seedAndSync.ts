/**
 * Seed person/household/plaid item (stub token) and PutEvents PlaidSyncRequested.
 * Requires DATABASE_URL + LocalStack EventBridge.
 */
import { randomUUID } from "node:crypto";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  TokenVault,
  createPool,
  runMigrations,
  seedPlaidConnection,
  SOURCE_PLAID,
  DETAIL_PLAID_SYNC_REQUESTED,
} from "@penny/core";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required");

  const pool = createPool(databaseUrl);
  await runMigrations(pool);

  const vault = new TokenVault(process.env.TOKEN_ENCRYPTION_KEY ?? "local-dev-only-not-for-prod");
  const accessToken = process.env.PLAID_ACCESS_TOKEN ?? "access-sandbox-stub-token";
  const seeded = await seedPlaidConnection(pool, {
    plaidItemExternalId: process.env.PLAID_ITEM_EXTERNAL_ID ?? `item-stub-${randomUUID()}`,
    accessTokenEncrypted: vault.encrypt(accessToken),
  });

  const eventId = randomUUID();
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const events = new EventBridgeClient({
    region: process.env.AWS_REGION ?? "us-east-1",
    ...(endpoint
      ? {
          endpoint,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
          },
        }
      : {}),
  });

  await events.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: process.env.EVENT_BUS_NAME ?? "penny",
          Source: SOURCE_PLAID,
          DetailType: DETAIL_PLAID_SYNC_REQUESTED,
          Detail: JSON.stringify({
            schema_version: 1,
            event_id: eventId,
            correlation_id: eventId,
            person_id: seeded.personId,
            household_id: seeded.householdId,
            plaid_item_id: seeded.itemId,
            mode: "initial_backfill",
            reason: "manual",
          }),
        },
      ],
    }),
  );

  console.log(
    JSON.stringify(
      {
        personId: seeded.personId,
        householdId: seeded.householdId,
        plaidItemId: seeded.itemId,
        eventId,
      },
      null,
      2,
    ),
  );

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
