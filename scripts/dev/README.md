# Local development toolchain

Run from the repo root.

```bash
./scripts/dev/install-prereqs.sh
./scripts/dev/verify-prereqs.sh
./scripts/dev/kind-up.sh
./scripts/dev/provision-localstack.sh
```

`install-prereqs.sh` installs **kubectl**, **kind**, **Helm**, and **AWS CLI v2** into `~/.local/bin` (override with `PENNY_BIN`). It does **not** install Docker — install Docker Desktop (macOS) or Docker Engine (Linux) first and ensure `docker info` works.

`kind-up.sh` creates the `penny` kind cluster and LocalStack (EventBridge, SQS, S3). `provision-localstack.sh` creates the bus, queues, DLQs, S3 bucket, and EventBridge rules.

See [docs/architecture/plaid-sync-local-aws.md](../../docs/architecture/plaid-sync-local-aws.md).
