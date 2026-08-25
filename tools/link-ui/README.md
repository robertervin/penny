# Penny · Link accounts (local)

Plaid Link UI for connecting your institutions to Penny’s ledger.

## Prerequisites

1. **Postgres** — `../../scripts/dev/postgres-up.sh` or kind Postgres
2. **LocalStack** (EventBridge/SQS) — `../../scripts/dev/kind-up.sh` + `provision-localstack.sh`  
   Or run LocalStack another way; sync events need the `penny` bus.
3. **`.env`** in `services/workflow-processor` with Plaid keys and `PLAID_STUB=false`

## Run (three terminals)

```bash
# Terminal 1 — API
cd services/workflow-processor
npm run migrate   # once
npm run api:dev

# Terminal 2 — workflow processor (ingests sync)
npm run dev

# Terminal 3 — Link UI
cd tools/link-ui
npm install
npm run dev
```

Open **http://localhost:5174** → **Connect with Plaid** → after success, watch ledger counts on the status card.

## Ports

| Service | Port |
|---|---|
| Link UI | 5174 |
| Plaid API | 3001 |
| Postgres | 5432 |
