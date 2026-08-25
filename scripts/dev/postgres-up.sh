#!/usr/bin/env bash
# Local Postgres for Plaid Link + workflow processor (no kind required).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
command -v docker >/dev/null || { echo "Docker required" >&2; exit 1; }
docker compose -f "${ROOT}/docker-compose.yml" up -d postgres
echo "Postgres: postgres://penny:penny@localhost:5432/penny"
echo "Run migrations: cd services/workflow-processor && npm run migrate"
