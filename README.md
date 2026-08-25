# penny
Your personal finance AI Assistant

## Local infrastructure (Kubernetes + EventBridge/SQS)

Workers will run in Kubernetes locally (kind) and later on EKS. Queues and routing are EventBridge → SQS locally via LocalStack, the same shape as AWS.

```bash
./scripts/dev/install-prereqs.sh
./scripts/dev/verify-prereqs.sh
./scripts/dev/kind-up.sh
./scripts/dev/provision-localstack.sh
./scripts/dev/smoke-eventbridge.sh
```

Details: [docs/architecture/plaid-sync-local-aws.md](docs/architecture/plaid-sync-local-aws.md) and [scripts/dev/README.md](scripts/dev/README.md).
