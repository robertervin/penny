#!/usr/bin/env bash
# Stop Penny dev tmux sessions started by link-stack-start.sh
set -euo pipefail

SESSIONS=(
  penny-api
  penny-workflow-processor
  penny-sms-gateway
  penny-link-ui
  penny-mfb
  # legacy session names from older runs
  penny-processor
  penny-sms
)

stopped=0
for session in "${SESSIONS[@]}"; do
  if tmux has-session -t "$session" 2>/dev/null; then
    tmux kill-session -t "$session"
    echo "Stopped tmux session: $session"
    stopped=$((stopped + 1))
  fi
done

if [[ "$stopped" -eq 0 ]]; then
  echo "No Penny tmux sessions were running."
else
  echo "Stopped $stopped session(s)."
fi
