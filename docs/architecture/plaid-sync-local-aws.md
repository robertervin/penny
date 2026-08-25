# Plaid sync slice: local Kubernetes → AWS

This is the implementation plan for vertical slice 1 (Plaid transactions + balances) with a **local-first** path that matches how we will run in AWS later.

Background work is **one Kubernetes deployment**: `penny-workflow-processor`. It long-polls a single SQS queue, inspects each event’s **source, detail-type, and schema**, and dispatches to a registered workflow. Workflows do not talk to each other in-process as a hidden shortcut: when a workflow needs another, it `PutEvents` on EventBridge like any other producer.

Implementation lives in `services/workflow-processor`. This document is the contract; `scripts/dev/` bootstraps the local data plane.

---

## Target topology (local and AWS)

```
                    PutEvents
  [producers] ──────────────────► EventBridge bus (penny)
   link, webhook,                    │
   manual, schedule,                 │ one rule: source prefix penny.
   other workflows                   ▼
                              SQS: penny-workflow
                                     │ long poll
                                     ▼
                    [penny-workflow-processor Deployment]
                    Kubernetes (one service, many workflows)
                    • parse envelope (source, detail-type, schema)
                    • route to workflow registry
                    • PlaidSyncRequested  → plaid sync workflow
                    • PlaidSnapshotReady  → ledger ingest workflow
                    • unknown / invalid   → do not retry forever (DLQ)
```

| Piece | Local | AWS later |
|---|---|---|
| Compute | **kind**, Deployment `penny-workflow-processor` | EKS, same Deployment |
| Routing | LocalStack **EventBridge** | AWS EventBridge |
| Work | LocalStack **SQS** (`penny-workflow` + DLQ) | AWS SQS + DLQ |
| Ledger | Postgres in-cluster | RDS Postgres |
| Snapshot blobs | LocalStack S3 | S3 |
| Secrets | Kubernetes Secrets / `.env` | Secrets Manager + IRSA |
| Plaid | Sandbox API from the cluster (egress) | Same |

Do **not** use a local-only queue (Redis, NATS, in-process) for this pipeline. That would force a rewrite when EventBridge/SQS land. LocalStack is the compatibility layer.

HTTP-facing pieces (Link token, Plaid webhooks) stay **separate** Deployments: they only `PutEvents` and return. They are not background workers.

---

## Workflow processor (single deployment)

This is the unit of scale and the unit of deploy. New product work is a **new workflow module + event contract**, not a new service.

### Process shape

1. Long-poll `penny-workflow`.
2. SQS body is the EventBridge wrapper; `detail` is our payload.
3. Build a **canonical envelope** (see below).
4. **Router** looks up `(source, detail-type, schema_version)` in a registry.
5. Run the workflow with a bounded timeout. Delete the SQS message on success. On retryable failure, throw (visibility timeout + receive count). On permanent failure (unknown type, invalid schema), send to DLQ / delete after recording — do not block the queue.

Concurrency: a small in-process pool (e.g. N goroutines/workers). **Plaid item lock** still lives in the Plaid sync workflow (one in-flight sync per item). Two different event types may run in the same pod at once (fetch for item A, ingest for item B).

### Envelope (what routing keys off)

Every bus event must be parseable without knowing the workflow:

| Field | Where | Role |
|---|---|---|
| `source` | EventBridge `Source` | Bounded context: `penny.plaid`, later `penny.audit`, `penny.goals` |
| `detail-type` | EventBridge `DetailType` | Verb: `PlaidSyncRequested`, `PlaidSnapshotReady` |
| `schema_version` | `detail.schema_version` | Payload compatibility |
| `event_id` | `detail.event_id` | Idempotency |
| `correlation_id` | `detail.correlation_id` | Trace a Link/webhook through multiple workflows |
| `detail` | JSON object | Workflow-specific; validated by that workflow’s schema |

Router **does not** switch on ad-hoc JSON inside `detail` (merchant names, Plaid raw). If two workflows would collide on the same detail-type, they are the same workflow or the type was named wrong.

Unknown `source` / `detail-type`: log, metric `workflow.unroutable`, **do not retry** (bad type will never become good). Invalid `detail` for a known type: retry only if it looks like truncation; otherwise permanent fail.

### Registry (v1)

| source | detail-type | Workflow | Side effects |
|---|---|---|---|
| `penny.plaid` | `PlaidSyncRequested` | Plaid sync | Call Plaid, write snapshot blob, `PutEvents` `PlaidSnapshotReady` |
| `penny.plaid` | `PlaidSnapshotReady` | Ledger ingest | Upsert accounts/balances/txns, commit Plaid cursor |

Later rows (same processor): audit recompute, goal/waterfall, 30-day experiments, cliffs. Each is a module with a `Handle(ctx, envelope) error` and a JSON schema for `detail`.

### Do not short-circuit the bus

After Plaid sync, **do not** call ledger ingest in-process. Publish `PlaidSnapshotReady` so:

- ingest is retryable independently of Plaid
- the cursor protocol stays “commit after ingest”
- the same routing path is tested in prod
- a future extra consumer (metrics, debug archive) is a new EventBridge rule, not a code edit in fetch

The processor may **receive** that second event on the same queue, possibly the same pod. That is intended.

### Timeouts and the one queue

One queue means **one visibility timeout**: **5 minutes** (Plaid pagination is the slow path). Fast ingest jobs simply finish early. `maxReceiveCount = 5` → `penny-workflow-dlq`.

If a workflow is routinely slower than 5 minutes, extend heartbeat (`ChangeMessageVisibility`) inside that workflow — not a second queue — until we have evidence we need isolation.

### Isolation we are accepting

Fetch and ingest share CPU, deploys, and failure domains. That is the point of consolidation. If Plaid rate limits or a poison ingest saturates the pool, we add **in-process fairness** (separate concurrency slots per workflow) before we split Deployments again.

---

## Eventing: EventBridge + SQS (not SQS-only)

**EventBridge** is the public event API. Producers only `PutEvents`. They do not need queue URLs.

**SQS** is the worker API. The processor only `ReceiveMessage` / `DeleteMessage`.

### Bus and rules

- Bus name: `penny`.
- **One rule** for background work: EventBridge `source` prefix `penny.` → SQS `penny-workflow`.
- Workflows are distinguished **inside** the processor, not by extra queues.

A second rule is only justified later (e.g. archive all events to S3, or a truly isolated latency class). Do not add per-workflow queues by default.

### Queues

| Queue | DLQ | Visibility timeout |
|---|---|---|
| `penny-workflow` | `penny-workflow-dlq` | 5 minutes |

Standard SQS (not FIFO). Ordering per Plaid **item** is a **DB lock** in the Plaid sync workflow.

### Payload size

- `PlaidSyncRequested` is small; fine on the bus.
- `PlaidSnapshotReady` carries a **pointer** (`payload_ref`) to S3 plus `sync_attempt_id`. Never put the full transaction list on the bus.

### Idempotency and tracing

`event_id`, `correlation_id`, `schema_version` on every `detail`. Processed-events table is **global** to the processor (one row per `event_id`), not per workflow.

SDK endpoint: `AWS_ENDPOINT_URL` (LocalStack `http://localstack.penny.svc.cluster.local:4566` in-cluster, `http://localhost:4566` on the host).

---

## Kubernetes (local kind ≈ future EKS)

### Cluster

- Tool: **kind**. Cluster name: `penny`. Namespace: `penny`.

### Workloads (when we write them)

| Deployment | Role | Replicas (local) |
|---|---|---|
| `penny-workflow-processor` | SQS → router → workflows | 1 |
| `plaid-webhook` / API (later) | HTTP → `PutEvents` only | 1 |

The processor is a long-running process (not Lambda). KEDA on SQS depth can come later.

### Config (env, same keys everywhere)

```text
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localstack.penny.svc.cluster.local:4566   # empty in real AWS
EVENT_BUS_NAME=penny
WORKFLOW_QUEUE_URL=...
PAYLOAD_BUCKET=penny-plaid-snapshots
DATABASE_URL=postgres://...
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
```

In AWS, drop `AWS_ENDPOINT_URL` and use IRSA.

### Local images

`kind load docker-image` (or Tilt/Skaffold later).

### Ingress / ports (local)

See `deploy/local/kind-cluster.yaml`: host `4566` → LocalStack, host `5432` reserved for Postgres.

---

## Local data plane

### LocalStack

Services: **events**, **sqs**, **s3**, **sts**, **iam**.

`scripts/dev/provision-localstack.sh` creates:

- Event bus `penny`
- `penny-workflow` + `penny-workflow-dlq` + redrive
- S3 bucket `penny-plaid-snapshots`
- One EventBridge rule (`source` prefix `penny.`) targeting the workflow queue

Dummy keys: `test` / `test`. Endpoint: `http://localhost:4566`.

### Postgres

Official image StatefulSet later, with the processor.

### Plaid

Sandbox egress from the cluster to `sandbox.plaid.com`.

---

## Plaid workflows (protocol inside the processor)

- Sync unit: **Plaid Item** (`access_token`, transactions cursor).
- After sync: `PutEvents` `PlaidSnapshotReady` (per account or one envelope + `sync_attempt_id`).
- **Cursor advances only after ledger ingest commits** that attempt.
- One in-flight Plaid sync per item (DB lock in the sync workflow).
- Webhook HTTP handler only verifies, stores, `PutEvents`.

---

## AWS promotion (later, no local rewrite)

1. Same `penny-workflow-processor` image.
2. Terraform/CDK: bus, **one** rule, queue, DLQ, S3, RDS, IRSA for that Deployment.
3. Unset `AWS_ENDPOINT_URL`.
4. EventBridge Scheduler for catch-up syncs (still `PutEvents`).

---

## Prerequisites vs bootstrap

| Script | Purpose |
|---|---|
| `scripts/dev/install-prereqs.sh` | kubectl, kind, helm, awscli → `~/.local/bin`. Does not install Docker. |
| `scripts/dev/verify-prereqs.sh` | Fail if tools or Docker are missing. |
| `scripts/dev/kind-up.sh` | Create/reuse kind cluster + LocalStack. |
| `scripts/dev/provision-localstack.sh` | Bus, workflow queue, S3, rule. |
| `scripts/dev/smoke-eventbridge.sh` | `PlaidSyncRequested` lands on `penny-workflow`. |

**Preferred:** LocalStack Deployment in namespace `penny` (already in `deploy/local/localstack.yaml`).

---

## Implementation order

1. Prereqs + kind + LocalStack provision — done (`scripts/dev/`, `deploy/local/`).
2. Postgres + schema — done (`deploy/local/postgres.yaml`, `migrations/001_init.sql`).
3. **`penny-workflow-processor`** — done (`services/workflow-processor`): SQS consumer, envelope router, Plaid sync + ledger ingest (stub or live Plaid).
4. Link / webhook API `PutEvents` — next.
5. AWS EventBridge/SQS/EKS using the same event names — later.

---

## Tool versions (pin)

| Tool | Version floor |
|---|---|
| Docker Engine / Desktop | 24+ |
| kubectl | 1.31.x (match kind node image) |
| kind | 0.27.x |
| Helm | 3.16+ |
| AWS CLI | 2.x |
| kind node image | `kindest/node:v1.31.4` |
