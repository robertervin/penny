#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f src/.env ]]; then
  echo "Missing src/.env. Copy src/.env.example and fill in Plaid credentials."
  exit 1
fi

echo "Starting Penny local stack (Mac / laptop — not Cloud Agent VM)."
echo "Requires Docker Desktop and kind. See docs/local-development.md"
echo ""

./scripts/dev/kind-up.sh
./scripts/dev/provision-localstack.sh

npm install
npm run migrate

SESSION_API="penny-api"
SESSION_PROCESSOR="penny-workflow-processor"
SESSION_LINK_UI="penny-link-ui"

start_tmux_session() {
  local session_name="$1"
  local command="$2"
  if tmux has-session -t "$session_name" 2>/dev/null; then
    echo "Session $session_name already running"
    return
  fi
  tmux new-session -d -s "$session_name" -c "$ROOT_DIR" -- bash -lc "$command"
}

start_tmux_session "$SESSION_API" "npm run api:dev"
start_tmux_session "$SESSION_PROCESSOR" "npm run processor:dev"
start_tmux_session "$SESSION_LINK_UI" "cd tools/link-ui && npm install && npm run dev -- --host 127.0.0.1 --port 5174"

echo ""
echo "Penny link stack started on this machine:"
echo "  API:                 http://localhost:3001"
echo "  Link UI:             http://localhost:5174"
echo "  tmux sessions:       $SESSION_API, $SESSION_PROCESSOR, $SESSION_LINK_UI"
echo ""
echo "Set PENNY_HOUSEHOLD_ID + PENNY_PERSON_ID in src/.env after Link UI bootstrap (used by penny-mcp)."
