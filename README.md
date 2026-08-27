# penny
Your personal finance AI Assistant

## Terminology

Product and architecture vocabulary (client file, Situation, Audit vs Interpret, Guidance, etc.): [docs/terminology.md](docs/terminology.md).

## Monorepo layout

All deployables live under `src/`:

| Package | Path | Description |
|---|---|---|
| `@penny/core` | [src/core](src/core) | Shared DB models, events, interpret, Plaid, AWS |
| `@penny/api` | [src/api](src/api) | HTTP API (Plaid Link, Situation, Memory) |
| `@penny/workflow-processor` | [src/workflow-processor](src/workflow-processor) | SQS consumer + workflow router |

Copy `src/.env.example` to `src/.env` before running services locally.

```bash
npm install
npm run migrate
npm run api:dev          # port 3001
npm run processor:dev    # SQS worker
```

Or use `./scripts/dev/link-stack-start.sh` for API + processor + Link UI.

## Local infrastructure (Kubernetes + EventBridge/SQS)

Background work is one Kubernetes Deployment (`penny-workflow-processor`) that reads a single SQS queue and routes by event type. EventBridge → SQS is LocalStack locally and AWS later.

```bash
./scripts/dev/install-prereqs.sh
./scripts/dev/verify-prereqs.sh
./scripts/dev/kind-up.sh
./scripts/dev/provision-localstack.sh
./scripts/dev/smoke-eventbridge.sh
```

API: [src/api/README.md](src/api/README.md)  
Workflow processor: [src/workflow-processor/README.md](src/workflow-processor/README.md)  
Messages for Business local prototype: [tools/mfb-prototype/README.md](tools/mfb-prototype/README.md)  
Plaid Link (connect your accounts locally): [tools/link-ui/README.md](tools/link-ui/README.md)  
Architecture: [docs/architecture/plaid-sync-local-aws.md](docs/architecture/plaid-sync-local-aws.md)  
Scripts: [scripts/dev/README.md](scripts/dev/README.md)
