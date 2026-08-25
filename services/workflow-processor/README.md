# Penny workflow processor

Background worker that long-polls SQS `penny-workflow`, routes on EventBridge
`source` + `detail-type` + `schema_version`, and runs:

| source | detail-type | workflow |
|---|---|---|
| `penny.plaid` | `PlaidSyncRequested` | Fetch Plaid txns/balances → S3 snapshot → `PutEvents` `PlaidSnapshotReady` |
| `penny.plaid` | `PlaidSnapshotReady` | Upsert accounts/balances/transactions; commit Plaid cursor |

## Develop

```bash
cd services/workflow-processor
npm install
npm test
npm run build
```

## Run locally (against kind LocalStack + Postgres)

```bash
# from repo root
./scripts/dev/kind-up.sh
kubectl apply -f deploy/local/postgres.yaml
./scripts/dev/provision-localstack.sh

export PATH="$HOME/.local/bin:$PATH"
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_REGION=us-east-1
export EVENT_BUS_NAME=penny
export WORKFLOW_QUEUE_URL=$(aws --endpoint-url "$AWS_ENDPOINT_URL" sqs get-queue-url \
  --queue-name penny-workflow --query QueueUrl --output text)
# If the URL host is localstack / localhost from inside a pod, rewrite as needed.
export DATABASE_URL=postgres://penny:penny@localhost:5432/penny
export PAYLOAD_BUCKET=penny-plaid-snapshots
export PLAID_STUB=true
export TOKEN_ENCRYPTION_KEY=local-dev-only-not-for-prod

cd services/workflow-processor
npm run migrate
npm run dev
```

In another shell:

```bash
./scripts/dev/seed-and-sync.sh
```

With `PLAID_STUB=true` the sync workflow invents a checking account + sample transactions.

## Deploy processor image into kind

```bash
docker build -t penny-workflow-processor:local services/workflow-processor
kind load docker-image penny-workflow-processor:local --name penny
kubectl apply -f deploy/local/workflow-processor.yaml
kubectl -n penny rollout status deploy/penny-workflow-processor
```

## Env

See `src/config/env.ts`. Important: leave `AWS_ENDPOINT_URL` empty in real AWS; set it for LocalStack.
