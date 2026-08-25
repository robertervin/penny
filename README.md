# penny
Your personal finance AI Assistant

## Terminology

Product and architecture vocabulary (client file, Situation, Audit vs Interpret, Guidance, etc.): [docs/terminology.md](docs/terminology.md).

## Local infrastructure (Kubernetes + EventBridge/SQS)

Background work is one Kubernetes Deployment (`penny-workflow-processor`) that reads a single SQS queue and routes by event type. EventBridge → SQS is LocalStack locally and AWS later.

```bash
./scripts/dev/install-prereqs.sh
./scripts/dev/verify-prereqs.sh
./scripts/dev/kind-up.sh
./scripts/dev/provision-localstack.sh
./scripts/dev/smoke-eventbridge.sh
```

Processor service: [services/workflow-processor/README.md](services/workflow-processor/README.md)  
Messages for Business local prototype: [tools/mfb-prototype/README.md](tools/mfb-prototype/README.md)  
Plaid Link (connect your accounts locally): [tools/link-ui/README.md](tools/link-ui/README.md)  
Architecture: [docs/architecture/plaid-sync-local-aws.md](docs/architecture/plaid-sync-local-aws.md)  
Scripts: [scripts/dev/README.md](scripts/dev/README.md)
