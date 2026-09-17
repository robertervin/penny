# Penny

Penny is a personal wealth-building and life-planning assistant.

Its goal is simple:

> **Help people build wealth and make better financial decisions without needing to become personal-finance experts.**

Penny connects to a user's real financial life, understands their goals, and answers the question that most financial tools leave to the user:

> **What should I do next with my money, given the life I want?**

## Who Penny is for

Penny initially serves two groups:

- **Everyday Wealth Builders** — people who already manage money responsibly but want better guidance, automation, and tradeoff analysis.
- **Guided Starters** — people who earn and save well but do not want to learn every nuance of investing, taxes, retirement accounts, and financial planning.

## What makes Penny different

Most financial products show users what happened.

Penny is designed to help decide what should happen next.

It should:

- understand cash flow, accounts, debt, benefits, and goals
- identify the highest-value next financial move
- explain recommendations in simple language
- help users evaluate big life decisions
- update the plan as life changes
- show tradeoffs instead of pretending every decision has one perfect answer

Penny should be sophisticated so the user does not have to be.

## Product principle

> **Penny recommends. The human decides and acts.**

Financial logic should be deterministic, transparent, and auditable. AI is the conversational layer that explains the plan, not the source of the underlying math.

## Core experience

> **Connect your finances → confirm Penny's understanding → build a personalized Money Routing Plan → get your next best move → ask “why?” or explore “what if?”**

The long-term vision is for Penny to become the financial decision layer that continuously helps households make the most of the money they earn while keeping their broader life goals in view.

> **Plaid and finance data run on your Mac only** — not in Cursor Cloud Agents.  
> See [docs/local-development.md](docs/local-development.md) for the full local stack.

## Vision and plan

Product vision and V1 scope: [docs/penny-v1-implementation-context.md](docs/penny-v1-implementation-context.md), [docs/penny-mvp-features.md](docs/penny-mvp-features.md).  
Deterministic routing engine spec: [docs/allocation-engine.md](docs/allocation-engine.md).  
What to build next: [docs/v0-implementation-plan.md](docs/v0-implementation-plan.md).

## Terminology

Product and architecture vocabulary (client file, Situation, Audit vs Interpret, Guidance, etc.): [docs/terminology.md](docs/terminology.md).

## Monorepo layout

All deployables live under `src/`:

| Package | Path | Description |
|---|---|---|
| `@penny/core` | [src/core](src/core) | Shared DB models, events, interpret, Plaid, AWS |
| `@penny/api-client` | [src/api-client](src/api-client) | Typed HTTP client for Penny API |
| `@penny/agent` | [src/agent](src/agent) | Shared agent tools, prompts, LLM runtime |
| `@penny/api` | [src/api](src/api) | HTTP API (Plaid Link, Situation, Memory, Explore) |
| `@penny/workflow-processor` | [src/workflow-processor](src/workflow-processor) | SQS consumer + workflow router |
| `penny-mcp` | [tools/penny-mcp](tools/penny-mcp) | MCP server for Cursor/ChatGPT |

The user-facing surface will be a **desktop app**, built after V0 data work lands. There is no
shipping UI today beyond the Plaid Link harness in [tools/link-ui](tools/link-ui).

Copy `src/.env.example` to `src/.env` on your **Mac** (never commit it; never paste Plaid keys into Cloud Agents).

**Quick start (Mac):**

```bash
./scripts/dev/link-stack-start.sh
```

Then open http://localhost:5174 (Link UI).

**Manual services:**

```bash
npm install
npm run migrate
npm run api:dev          # port 3001
npm run processor:dev    # SQS worker
```

Explore via MCP: see [tools/penny-mcp/README.md](tools/penny-mcp/README.md).  
Local dev guide: [docs/local-development.md](docs/local-development.md).

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
Plaid Link (connect your accounts locally): [tools/link-ui/README.md](tools/link-ui/README.md)  
Architecture: [docs/architecture/plaid-sync-local-aws.md](docs/architecture/plaid-sync-local-aws.md), [docs/architecture/transaction-memory.md](docs/architecture/transaction-memory.md)  
Scripts: [scripts/dev/README.md](scripts/dev/README.md)
