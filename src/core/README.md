# Penny core

Shared library used by the API and workflow processor:

- Database pool, migrations, and repositories
- Event envelopes and EventBridge publishers
- Interpret (classify transactions, compute Situation)
- Plaid client/gateway and token vault
- AWS clients (SQS, S3, EventBridge)

## Develop

From repo root:

```bash
npm install
npm test -w @penny/core
npm run migrate
```

Migrations live in `migrations/`. The migrate script reads `DATABASE_URL` from `src/.env`.
