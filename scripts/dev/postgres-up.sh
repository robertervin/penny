#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f src/.env ]]; then
  echo "Missing src/.env. Copy src/.env.example and fill in DATABASE_URL."
  exit 1
fi

set -a
source src/.env
set +a

docker compose -f deploy/local/postgres.yaml up -d

npm install
npm run migrate
