# penny
Your personal finance AI Assistant

## Terminology

Product and architecture vocabulary (client file, Situation, Audit vs Interpret, Guidance, etc.): [docs/terminology.md](docs/terminology.md).

## Monorepo layout

All deployables live under `src/`:

| Package | Path | Description |
|---|---|---|
| `@penny/core` | [src/core](src/core) | Shared DB models, events, interpret, Plaid, AWS |
| `@penny/api-client` | [src/api-client](src/api-client) | Typed HTTP client for Penny API |
| `@penny/agent` | [src/agent](src/agent) | Shared agent tools, prompts, LLM runtime |
| `@penny/api` | [src/api](src/api) | HTTP API (Plaid Link, Situation, Memory) |
| `@penny/workflow-processor` | [src/workflow-processor](src/workflow-processor) | SQS consumer + workflow router |
| `@penny/sms-gateway` | [src/sms-gateway](src/sms-gateway) | SMS explore + execute |
| `penny-mcp` | [tools/penny-mcp](tools/penny-mcp) | MCP server for Cursor/ChatGPT Explore |

Copy `src/.env.example` to `src/.env` before running services locally.

```bash
npm install
npm run migrate
npm run api:dev          # port 3001
npm run processor:dev    # SQS worker
npm run sms:dev          # SMS gateway port 3002
```

Explore via MCP: see [tools/penny-mcp/README.md](tools/penny-mcp/README.md).  
SMS gateway: [src/sms-gateway/README.md](src/sms-gateway/README.md).

Or use `./scripts/dev/link-stack-start.sh` for API + processor + SMS gateway + Link UI + MfB prototype.

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
Messages for Business local prototype: [tools/mfb-prototype/README.md](tools/mfb-prototype/README.md) (live chat via SMS gateway)  
Plaid Link (connect your accounts locally): [tools/link-ui/README.md](tools/link-ui/README.md)  
Architecture: [docs/architecture/plaid-sync-local-aws.md](docs/architecture/plaid-sync-local-aws.md)  
Scripts: [scripts/dev/README.md](scripts/dev/README.md)
