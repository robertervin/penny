#!/usr/bin/env bash
# Idempotent EventBridge bus, SQS queues, S3 bucket, and rules on LocalStack.
set -euo pipefail

PENNY_BIN="${PENNY_BIN:-${HOME}/.local/bin}"
export PATH="${PENNY_BIN}:${PATH}"

AWS_REGION="${AWS_REGION:-us-east-1}"
ENDPOINT="${AWS_ENDPOINT_URL:-http://localhost:4566}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
export AWS_DEFAULT_REGION="${AWS_REGION}"

command -v aws >/dev/null || { echo "aws CLI is required; ./scripts/dev/install-prereqs.sh" >&2; exit 1; }

aws_ls() {
  aws --endpoint-url "${ENDPOINT}" --region "${AWS_REGION}" "$@"
}

echo "LocalStack endpoint: ${ENDPOINT}"

# Health (LocalStack)
if ! curl -fsS "${ENDPOINT}/_localstack/health" >/dev/null; then
  echo "LocalStack is not reachable at ${ENDPOINT}." >&2
  echo "Run ./scripts/dev/kind-up.sh and wait until the localstack pod is ready." >&2
  exit 1
fi

BUS_NAME="penny"
BUCKET="penny-plaid-snapshots"

SYNC_Q="plaid-sync-requested"
SYNC_DLQ="plaid-sync-requested-dlq"
SNAP_Q="plaid-snapshot-ready"
SNAP_DLQ="plaid-snapshot-ready-dlq"

ensure_queue() {
  local name="$1"
  aws_ls sqs create-queue --queue-name "${name}" >/dev/null
}

queue_url() {
  aws_ls sqs get-queue-url --queue-name "$1" --query QueueUrl --output text
}

queue_arn() {
  local url="$1"
  aws_ls sqs get-queue-attributes --queue-url "${url}" --attribute-names QueueArn \
    --query Attributes.QueueArn --output text
}

ensure_queue "${SYNC_DLQ}"
ensure_queue "${SNAP_DLQ}"
ensure_queue "${SYNC_Q}"
ensure_queue "${SNAP_Q}"

SYNC_DLQ_URL="$(queue_url "${SYNC_DLQ}")"
SNAP_DLQ_URL="$(queue_url "${SNAP_DLQ}")"
SYNC_URL="$(queue_url "${SYNC_Q}")"
SNAP_URL="$(queue_url "${SNAP_Q}")"
SYNC_DLQ_ARN="$(queue_arn "${SYNC_DLQ_URL}")"
SNAP_DLQ_ARN="$(queue_arn "${SNAP_DLQ_URL}")"
SYNC_ARN="$(queue_arn "${SYNC_URL}")"
SNAP_ARN="$(queue_arn "${SNAP_URL}")"

redrive() {
  local url="$1"
  local dlq_arn="$2"
  local vis="$3"
  local attrs
  attrs="$(printf '{"RedrivePolicy":"{\\"deadLetterTargetArn\\":\\"%s\\",\\"maxReceiveCount\\":\\"5\\"}","VisibilityTimeout":"%s"}' "${dlq_arn}" "${vis}")"
  aws_ls sqs set-queue-attributes --queue-url "${url}" --attributes "${attrs}" >/dev/null
}

redrive "${SYNC_URL}" "${SYNC_DLQ_ARN}" "300"
redrive "${SNAP_URL}" "${SNAP_DLQ_ARN}" "60"

aws_ls s3api create-bucket --bucket "${BUCKET}" >/dev/null 2>&1 || true

# Event bus (default bus always exists; we use a custom bus)
aws_ls events create-event-bus --name "${BUS_NAME}" >/dev/null 2>&1 || true

# Allow EventBridge to send to SQS (LocalStack is permissive; still set a policy for AWS parity)
put_queue_policy() {
  local url="$1"
  local arn="$2"
  local sid="$3"
  local policy
  policy="$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "${sid}",
      "Effect": "Allow",
      "Principal": {"Service": "events.amazonaws.com"},
      "Action": "sqs:SendMessage",
      "Resource": "${arn}"
    }
  ]
}
EOF
)"
  aws_ls sqs set-queue-attributes --queue-url "${url}" --attributes "Policy=${policy}" >/dev/null
}

put_queue_policy "${SYNC_URL}" "${SYNC_ARN}" "AllowEventBridgeSync"
put_queue_policy "${SNAP_URL}" "${SNAP_ARN}" "AllowEventBridgeSnap"

put_rule() {
  local name="$1"
  local detail_type="$2"
  local target_arn="$3"
  local target_id="$4"
  aws_ls events put-rule \
    --name "${name}" \
    --event-bus-name "${BUS_NAME}" \
    --event-pattern "$(printf '{"source":["penny.plaid"],"detail-type":["%s"]}' "${detail_type}")" \
    --state ENABLED >/dev/null
  aws_ls events put-targets \
    --event-bus-name "${BUS_NAME}" \
    --rule "${name}" \
    --targets "Id=${target_id},Arn=${target_arn}" >/dev/null
}

put_rule "plaid-sync-requested-to-sqs" "PlaidSyncRequested" "${SYNC_ARN}" "sync-sqs"
put_rule "plaid-snapshot-ready-to-sqs" "PlaidSnapshotReady" "${SNAP_ARN}" "snap-sqs"

echo
echo "Provisioned LocalStack resources"
echo "  event bus:     ${BUS_NAME}"
echo "  s3:            s3://${BUCKET}"
echo "  queue:         ${SYNC_Q}"
echo "  queue:         ${SNAP_Q}"
echo "  dlq:           ${SYNC_DLQ}"
echo "  dlq:           ${SNAP_DLQ}"
echo
echo "Smoke PutEvents (PlaidSyncRequested) then:"
echo "  aws --endpoint-url ${ENDPOINT} sqs receive-message --queue-url ${SYNC_URL} --wait-time-seconds 1"
echo
echo "Queue URLs:"
echo "  ${SYNC_URL}"
echo "  ${SNAP_URL}"
