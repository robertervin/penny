# Plaid sync slice: local Kubernetes → AWS

This is the implementation plan for vertical slice 1 (Plaid transactions + balances) with a **local-first** path that matches how we will run in AWS later.

Workers never talk to each other. They talk to **EventBridge** (routing) and **SQS** (work). The same code uses the AWS SDK locally against **LocalStack**.

Application fetch/ingest code is **not** in this change. This document plus `scripts/dev/` are the contract and the machine setup.

---

## Target topology (local and AWS)

```
                    PutEvents
  [producers] ──────────────────► EventBridge bus (penny)
   link, webhook,                    │
   manual, schedule                  │ rules (event pattern)
                                     ▼
                              SQS: plaid-sync-requested
                                     │ long poll
                                     ▼
                           [plaid-fetch Deployment]
                           Kubernetes
                           • load item token
                           • Plaid /transactions/sync
                           • Plaid /accounts/balance/get
                           • write snapshot blob
                           • PutEvents snapshot.ready
                                     │
                                     ▼
                              SQS: plaid-snapshot-ready
                                     │
                                     ▼
                         [ledger-ingest Deployment]
                           • upsert accounts / balances / txns
                           • commit Plaid cursor after success
```

| Piece | Local | AWS later |
|---|---|---|
| Compute | **kind** cluster, Deployments | EKS (or equivalent), same manifests |
| Routing | LocalStack **EventBridge** | AWS EventBridge |
| Work | LocalStack **SQS** | AWS SQS (+ DLQs) |
| Ledger | Postgres in-cluster | RDS Postgres |
| Snapshot blobs | MinIO in-cluster **or** LocalStack S3 | S3 |
| Secrets | Kubernetes Secrets / `.env` | Secrets Manager + IRSA |
| Plaid | Sandbox API from the cluster (egress) | Same |

Do **not** use a local-only queue (Redis, NATS, in-process) for this pipeline. That would force a rewrite when EventBridge/SQS land. LocalStack is the compatibility layer.

---

## Eventing: EventBridge + SQS (not SQS-only)

**EventBridge** is the public event API. Producers only `PutEvents`. They do not need queue URLs.

**SQS** is the worker API. Consumers only `ReceiveMessage` / `DeleteMessage`. They do not subscribe to the bus directly.

### Bus and rules

- Bus name: `penny` (same locally and in AWS; accounts/regions differ).
- Custom event source: `penny.plaid` (EventBridge “source”).
- `detail-type` values:
  - `PlaidSyncRequested`
  - `PlaidSnapshotReady`

Rules (content filter on `source` + `detail-type`) each target **one** SQS queue. Adding a third consumer later is a new rule, not a change to the fetch worker.

### Queues

| Queue | DLQ | Visibility timeout (starting point) |
|---|---|---|
| `plaid-sync-requested` | `plaid-sync-requested-dlq` | 5 minutes (Plaid pagination) |
| `plaid-snapshot-ready` | `plaid-snapshot-ready-dlq` | 60 seconds |

Use **standard** SQS locally and in v1 AWS. Ordering per Plaid **item** is enforced in the fetch worker with a **DB lock** (`SELECT … FOR UPDATE` on `plaid_items` or `pg_advisory_lock(item_id)`), not with SQS FIFO. FIFO + EventBridge is awkward; a lock is the right invariant anyway.

Redrive: `maxReceiveCount = 5` → DLQ.

### Payload size

SQS is 256 KB. EventBridge is 256 KB per event.

- `PlaidSyncRequested` is small (ids + mode). Fine on the bus.
- `PlaidSnapshotReady` carries a **pointer** (`payload_ref`) to S3/MinIO/LocalStack S3, plus `sync_attempt_id`. Never put the full transaction list on the bus.

### Idempotency and tracing

Every event:

- `event_id` (UUID) — ingest dedupe table
- `correlation_id` — one Link/webhook through fetch + ingest
- `schema_version`

Workers use the AWS SDK `AWS_ENDPOINT_URL` (LocalStack: `http://localstack.penny.svc:4566` in-cluster, `http://localhost:4566` from a laptop).

---

## Kubernetes (local kind ≈ future EKS)

### Cluster

- Tool: **kind** (Kubernetes-in-Docker). Close enough to EKS for Deployments, Services, ConfigMaps, Secrets, and later HPA/KEDA.
- Cluster name: `penny`.
- Namespaces: `penny` (app + data plane).

### Workloads (when we write them)

| Deployment | Role | Replicas (local) |
|---|---|---|
| `plaid-fetch` | Consume `plaid-sync-requested`, call Plaid, `PutEvents` | 1 |
| `ledger-ingest` | Consume `plaid-snapshot-ready`, write Postgres | 1 |
| `plaid-webhook` (later) | HTTP → `PutEvents` only | 1 |

Each worker is a long-running process: **SQS long poll in a loop** (not Lambda). That is the EKS model. KEDA SQS scalers can come later; do not require them locally.

### Config (env, same keys everywhere)

```text
AWS_REGION=us-east-1
AWS_ENDPOINT_URL=http://localstack.penny.svc.cluster.local:4566   # empty in real AWS
EVENT_BUS_NAME=penny
PLAID_SYNC_REQUESTED_QUEUE_URL=...
PLAID_SNAPSHOT_READY_QUEUE_URL=...
PAYLOAD_BUCKET=penny-plaid-snapshots
DATABASE_URL=postgres://...
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox
```

In AWS, drop `AWS_ENDPOINT_URL` and use IRSA. No other branch in business logic.

### Local images

kind does not see Docker Desktop images unless you `kind load docker-image`. Document that in the worker README when those images exist. Optional later: Tilt or Skaffold for inner loop.

### Ingress / ports (local)

kind `extraPortMappings` (see `deploy/local/kind-cluster.yaml`):

- `4566` — LocalStack (AWS APIs from the host)
- `5432` — Postgres (optional host access for `psql`)
- `9000` — MinIO API if used instead of LocalStack S3

---

## Local data plane

### LocalStack

Services: **events** (EventBridge), **sqs**, **s3**, **sts**, **iam** (enough for the SDK).

On first boot, `scripts/dev/provision-localstack.sh` creates:

- Event bus `penny`
- Four queues (two main + two DLQ) + redrive
- S3 bucket `penny-plaid-snapshots`
- Two rules + SQS permissions so EventBridge can `SendMessage`

Provision with AWS CLI against `AWS_ENDPOINT_URL=http://localhost:4566` and dummy keys (`test` / `test`).

### Postgres

In-cluster via Helm (`bitnami` avoided; use the **official Postgres** image Deployment/StatefulSet in `deploy/local/` when we add manifests). Until then, the provision scripts only assume the kind cluster exists; DB manifests follow with the workers.

### Plaid

Sandbox from inside the cluster requires **egress** to `sandbox.plaid.com`. kind uses the host network path via the node; it works on a normal laptop. Corporate proxies are an ops exception, not a product fork.

---

## Plaid connection manager (unchanged protocol)

- Sync unit: **Plaid Item** (`access_token`, transactions cursor).
- Publish unit: **per account** `PlaidSnapshotReady` (or one envelope + per-account ingest), all sharing `sync_attempt_id`.
- **Cursor advances only after ingest commits** all accounts for that attempt.
- One in-flight fetch per item (DB lock).
- Webhook HTTP handler only verifies, stores, `PutEvents`; never calls Plaid.

See the event fields in the previous plan: `person_id`, `household_id`, `plaid_item_id`, optional `account_id`, `mode: incremental | initial_backfill`.

---

## AWS promotion (later, no local rewrite)

1. Same container images.
2. Terraform/CDK: bus, rules, queues, DLQs, S3, RDS, IRSA for `plaid-fetch` and `ledger-ingest`.
3. EKS Deployments = kind Deployments with different `AWS_ENDPOINT_URL` (unset) and secret refs.
4. EventBridge Scheduler replaces local cron for catch-up syncs.

---

## Prerequisites vs bootstrap

| Script | Purpose |
|---|---|
| `scripts/dev/install-prereqs.sh` | Install host tools (kubectl, kind, helm, awscli). Does **not** install Docker Desktop; it checks Docker. |
| `scripts/dev/verify-prereqs.sh` | Exit non-zero if anything is missing or Docker is down. |
| `scripts/dev/kind-up.sh` | Create/reuse `penny` kind cluster from `deploy/local/kind-cluster.yaml`. |
| `scripts/dev/provision-localstack.sh` | Idempotent EventBridge + SQS + S3 on LocalStack (run after LocalStack is up). |

Install LocalStack **in the cluster** (Helm) or **Docker** on the host. For “everything in Kubernetes,” prefer the Helm chart in the cluster and port-map 4566. A host Docker LocalStack is acceptable for day one if the cluster can reach `host.docker.internal:4566` (kind extraHost). **Preferred:** LocalStack Deployment in `penny` namespace so workers use a stable in-cluster DNS name.

---

## Implementation order (code still later)

1. Prereqs + kind cluster + LocalStack provision (this slice of the repo).
2. Postgres + schema.
3. Fetch worker + ingest worker as Deployments polling SQS.
4. Link token / webhook API `PutEvents`.
5. AWS EventBridge/SQS/EKS using the same event names.

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
