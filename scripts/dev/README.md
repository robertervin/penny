# Local development toolchain

Run from the repo root **on your Mac** (not Cursor Cloud Agents — see [docs/local-development.md](../../docs/local-development.md)).

```bash
./scripts/dev/install-prereqs.sh
./scripts/dev/verify-prereqs.sh
./scripts/dev/kind-up.sh
./scripts/dev/provision-localstack.sh
```

Or one command for the full app stack:

```bash
./scripts/dev/link-stack-start.sh
./scripts/dev/link-stack-restart.sh   # stop + start
./scripts/dev/link-stack-stop.sh      # stop only
```

`install-prereqs.sh` installs **kubectl**, **kind**, **Helm**, and **AWS CLI v2** into `~/.local/bin` (override with `PENNY_BIN`). It does **not** install Docker — install Docker Desktop (macOS) or Docker Engine (Linux) first and ensure `docker info` works.

`kind-up.sh` creates the `penny` kind cluster and LocalStack (EventBridge, SQS, S3). `provision-localstack.sh` creates the bus, the `penny-workflow` queue (+ DLQ), S3 bucket, and one EventBridge rule (`source` prefix `penny.`).

See [docs/architecture/plaid-sync-local-aws.md](../../docs/architecture/plaid-sync-local-aws.md).
