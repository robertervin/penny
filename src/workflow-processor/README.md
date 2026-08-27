# Penny workflow processor

Background worker that long-polls SQS `penny-workflow`, routes on EventBridge
`source` + `detail-type` + `schema_version`, and runs Plaid sync, ledger ingest, and interpret workflows.

Shared database models, events, and interpret logic live in [`@penny/core`](../core).

## Develop

From repo root:

```bash
npm install
npm test -w @penny/workflow-processor
npm run typecheck -w @penny/workflow-processor
```

## Run locally

Copy `src/.env.example` to `src/.env`, then from repo root:

```bash
./scripts/dev/postgres-up.sh
./scripts/dev/localstack-up.sh   # or kind + provision-localstack.sh
npm run migrate
npm run processor:dev
```

Seed a stub sync event:

```bash
./scripts/dev/seed-and-sync.sh
```

Or use the all-in-one link stack:

```bash
./scripts/dev/link-stack-start.sh
```

## Deploy processor image into kind

```bash
docker build -f src/workflow-processor/Dockerfile -t penny-workflow-processor:local .
kind load docker-image penny-workflow-processor:local --name penny
kubectl apply -f deploy/local/workflow-processor.yaml
kubectl -n penny rollout status deploy/penny-workflow-processor
```

## Env

See `src/core/src/config/env.ts`. Leave `AWS_ENDPOINT_URL` empty in real AWS; set it for LocalStack.
