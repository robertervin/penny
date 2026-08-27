#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f src/.env ]]; then
  echo "Missing src/.env. Copy src/.env.example and fill in Plaid credentials."
  exit 1
fi

npm run seed-and-sync -w @penny/workflow-processor
