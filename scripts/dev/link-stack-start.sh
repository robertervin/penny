#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f src/.env ]]; then
  echo "Missing src/.env. Copy src/.env.example and fill in Plaid credentials."
  exit 1
fi

./scripts/dev/postgres-up.sh
./scripts/dev/localstack-up.sh

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
start_tmux_session "$SESSION_LINK_UI" "cd tools/link-ui && npm install && npm run dev -- --host 0.0.0.0 --port 5174"

echo ""
echo "Penny link stack started:"
echo "  API:                 http://localhost:3001"
echo "  Link UI:             http://localhost:5174"
echo "  tmux sessions:       $SESSION_API, $SESSION_PROCESSOR, $SESSION_LINK_UI"
echo ""
echo "Stop with: tmux kill-session -t $SESSION_API; tmux kill-session -t $SESSION_PROCESSOR; tmux kill-session -t $SESSION_LINK_UI"
