#!/usr/bin/env bash
# Seed a stub Plaid connection and PutEvents PlaidSyncRequested (for local smoke).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}/services/workflow-processor"

export DATABASE_URL="${DATABASE_URL:?DATABASE_URL required}"
export TOKEN_ENCRYPTION_KEY="${TOKEN_ENCRYPTION_KEY:-local-dev-only-not-for-prod}"
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localhost:4566}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export EVENT_BUS_NAME="${EVENT_BUS_NAME:-penny}"

npx tsx src/scripts/seedAndSync.ts
