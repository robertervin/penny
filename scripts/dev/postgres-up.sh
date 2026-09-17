#!/usr/bin/env bash
# Start Postgres via the kind cluster (same as kind-up.sh).
# Prefer: ./scripts/dev/kind-up.sh (also starts LocalStack).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "postgres-up.sh delegates to kind-up.sh (Postgres + LocalStack on localhost)."
exec ./scripts/dev/kind-up.sh
