# Local development (Mac)

**Run Penny with real Plaid data on your Mac only.** Cloud Agents are for code changes (PRs, refactors, tests) — not for linking bank accounts or storing transaction data.

## Why local?

- Plaid access tokens and transaction history stay on your machine
- Postgres persists between sessions (your household, rules, ledger)
- Docker + kind + LocalStack match the intended sync pipeline

Cloud Agents use an isolated VM with a **fresh, empty database**. Port-forwarded `localhost:5173` in a Cloud Agent session points at that VM, not your Mac.

## Prerequisites (Mac)

1. **Docker Desktop** — running (`docker info` works)
2. **Node.js 20+** and npm
3. **tmux** (optional, for `link-stack-start.sh`): `brew install tmux`
4. Dev toolchain (first time only):

```bash
./scripts/dev/install-prereqs.sh   # kubectl, kind, helm, aws cli → ~/.local/bin
./scripts/dev/verify-prereqs.sh
```

## One-command stack

From repo root, with `src/.env` filled in (copy from `src/.env.example`):

```bash
cp src/.env.example src/.env   # if needed — edit Plaid keys + household IDs
./scripts/dev/link-stack-start.sh
```

This starts:

| Service | URL |
|---|---|
| MfB prototype (live chat) | http://localhost:5173 |
| Plaid Link UI | http://localhost:5174 |
| API | http://localhost:3001 |
| SMS gateway | http://localhost:3002 |

Infrastructure: kind cluster `penny` with Postgres (`localhost:5432`) and LocalStack (`localhost:4566`).

## Manual startup

```bash
./scripts/dev/kind-up.sh
./scripts/dev/provision-localstack.sh
npm install
npm run migrate

# separate terminals (or tmux)
npm run api:dev
npm run processor:dev
npm run sms:dev
cd tools/link-ui && npm run dev -- --port 5174
cd tools/mfb-prototype && npm run dev
```

## Link accounts

1. Open http://localhost:5174
2. Complete Plaid Link
3. Wait for sync (processor ingests via EventBridge → SQS)
4. Set `PENNY_DEV_HOUSEHOLD_ID` and `PENNY_DEV_PERSON_ID` in `src/.env` from bootstrap output
5. Text `WHY income` in MfB live mode or http://localhost:5173

## Verify data

```bash
curl -s "http://localhost:3001/api/household/$PENNY_DEV_HOUSEHOLD_ID/status" | jq
```

Expect non-zero `ledger.transactions` after sync.

## Cloud Agents

Use Cloud Agents for:

- Code review, refactors, tests, documentation
- Changes that do **not** require your real ledger

Do **not** in Cloud Agents:

- Copy `src/.env` with Plaid secrets into the VM
- Link bank accounts via Link UI in the forwarded port
- Expect `WHY income` to show your real data

The repo `.cursor/environment.json` installs npm deps only and prints a reminder — it does not start API, SMS, or Link UI in the cloud.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `WHY income` → no transactions | Run stack on Mac; check `status` for 0 txns |
| Processor `ECONNREFUSED :4566` | `docker info`, then `./scripts/dev/kind-up.sh` |
| MfB can't reach backend | `npm run sms:dev` and `npm run api:dev` on Mac |
| Empty situation after link | Wait for processor; or `POST /api/household/:id/interpret` |

See also [scripts/dev/README.md](../scripts/dev/README.md) and [plaid-sync-local-aws.md](architecture/plaid-sync-local-aws.md).
