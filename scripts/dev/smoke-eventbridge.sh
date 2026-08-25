#!/usr/bin/env bash
# Put a PlaidSyncRequested event on the bus and confirm it lands on SQS.
set -euo pipefail

PENNY_BIN="${PENNY_BIN:-${HOME}/.local/bin}"
export PATH="${PENNY_BIN}:${PATH}"

AWS_REGION="${AWS_REGION:-us-east-1}"
ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_REGION}"

aws_ls() {
  aws --endpoint-url "${ENDPOINT}" --region "${AWS_REGION}" "$@"
}

SYNC_URL="$(aws_ls sqs get-queue-url --queue-name plaid-sync-requested --query QueueUrl --output text)"
EVENT_ID="$(uuidgen 2>/dev/null || python3 -c 'import uuid; print(uuid.uuid4())')"

ENTRIES="$(cat <<EOF
[
  {
    "Source": "penny.plaid",
    "DetailType": "PlaidSyncRequested",
    "EventBusName": "penny",
    "Detail": "{\"event_id\":\"${EVENT_ID}\",\"schema_version\":1,\"reason\":\"smoke\"}"
  }
]
EOF
)"

aws_ls events put-events --entries "${ENTRIES}"
echo "put event_id=${EVENT_ID}"
echo "polling plaid-sync-requested..."
aws_ls sqs receive-message --queue-url "${SYNC_URL}" --wait-time-seconds 10 --max-number-of-messages 1
