#!/usr/bin/env bash
# Bootstrap Postgres + LocalStack + migrations for Plaid Link local dev.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PENNY_BIN="${PENNY_BIN:-${HOME}/.local/bin}"
export PATH="${PENNY_BIN}:${PATH}"

log() { printf '%s\n' "$*"; }

ensure_docker() {
  if ! command -v docker >/dev/null; then
    log "Docker not installed; skipping LocalStack container"
    return 1
  fi
  if ! docker info >/dev/null 2>&1; then
    sudo service docker start 2>/dev/null || true
    sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
  fi
  docker info >/dev/null 2>&1
}

ensure_postgres() {
  if command -v pg_isready >/dev/null && pg_isready -h localhost -U penny -d penny >/dev/null 2>&1; then
    return 0
  fi
  if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
    docker compose -f "${ROOT}/docker-compose.yml" up -d postgres
    for _ in $(seq 1 30); do
      pg_isready -h localhost -U penny -d penny >/dev/null 2>&1 && return 0
      sleep 1
    done
  fi
  if command -v pg_isready >/dev/null; then
    sudo service postgresql start 2>/dev/null || true
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='penny'" | grep -q 1 \
      || sudo -u postgres psql -c "CREATE USER penny WITH PASSWORD 'penny' CREATEDB;"
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='penny'" | grep -q 1 \
      || sudo -u postgres psql -c "CREATE DATABASE penny OWNER penny;"
    pg_isready -h localhost -U penny -d penny >/dev/null 2>&1
  else
    log "Postgres not available"
    return 1
  fi
}

ensure_localstack() {
  ensure_docker || return 1
  if ! curl -fsS http://localhost:4566/_localstack/health >/dev/null 2>&1; then
    docker rm -f penny-localstack >/dev/null 2>&1 || true
    docker run -d --name penny-localstack \
      -p 4566:4566 \
      -e SERVICES=sqs,s3,events,iam \
      localstack/localstack:3.8 >/dev/null
    for _ in $(seq 1 60); do
      curl -fsS http://localhost:4566/_localstack/health >/dev/null 2>&1 && break
      sleep 2
    done
  fi
  curl -fsS http://localhost:4566/_localstack/health >/dev/null
  AWS_REGION="${AWS_REGION:-us-east-2}" "${ROOT}/scripts/dev/provision-localstack.sh"
}

log "Starting Penny Link stack infrastructure…"
ensure_postgres
ensure_localstack || log "warn: LocalStack unavailable — sync after link will not work"

cd "${ROOT}/services/workflow-processor"
if [[ -f .env ]]; then
  npx tsx --env-file=.env src/db/migrate.ts
else
  DATABASE_URL="${DATABASE_URL:-postgres://penny:penny@localhost:5432/penny}" npm run migrate
fi

log "Infrastructure ready."
log "  Link UI:            http://localhost:5174"
log "  Plaid API:          http://localhost:3001"
log "  Postgres:           postgres://penny:penny@localhost:5432/penny"
log "  LocalStack:         http://localhost:4566"
