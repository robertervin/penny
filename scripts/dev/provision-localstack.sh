#!/usr/bin/env bash
# Idempotent EventBridge bus, one workflow SQS queue, S3, and a prefix rule.
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

if ! curl -fsS "${ENDPOINT}/_localstack/health" >/dev/null; then
  echo "LocalStack is not reachable at ${ENDPOINT}." >&2
  echo "Run ./scripts/dev/kind-up.sh and wait until the localstack pod is ready." >&2
  exit 1
fi

BUS_NAME="penny"
BUCKET="penny-plaid-snapshots"
WORK_Q="penny-workflow"
WORK_DLQ="penny-workflow-dlq"

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

ensure_queue "${WORK_DLQ}"
ensure_queue "${WORK_Q}"

WORK_DLQ_URL="$(queue_url "${WORK_DLQ}")"
WORK_URL="$(queue_url "${WORK_Q}")"
WORK_DLQ_ARN="$(queue_arn "${WORK_DLQ_URL}")"
WORK_ARN="$(queue_arn "${WORK_URL}")"

# 5 minutes: Plaid sync is the slow path; ingest finishes early.
REDRIVE="$(printf '{"RedrivePolicy":"{\\"deadLetterTargetArn\\":\\"%s\\",\\"maxReceiveCount\\":\\"5\\"}","VisibilityTimeout":"300"}' "${WORK_DLQ_ARN}")"
aws_ls sqs set-queue-attributes --queue-url "${WORK_URL}" --attributes "${REDRIVE}" >/dev/null

aws_ls s3api create-bucket --bucket "${BUCKET}" >/dev/null 2>&1 || true
aws_ls events create-event-bus --name "${BUS_NAME}" >/dev/null 2>&1 || true

POLICY_FILE="$(mktemp)"
cat > "${POLICY_FILE}" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowEventBridgeWorkflow",
      "Effect": "Allow",
      "Principal": {"Service": "events.amazonaws.com"},
      "Action": "sqs:SendMessage",
      "Resource": "${WORK_ARN}"
    }
  ]
}
EOF
ATTR_FILE="$(mktemp)"
python3 -c "import json; print(json.dumps({'Policy': open('${POLICY_FILE}').read()}))" > "${ATTR_FILE}"
aws_ls sqs set-queue-attributes --queue-url "${WORK_URL}" --attributes file://"${ATTR_FILE}" >/dev/null
rm -f "${POLICY_FILE}" "${ATTR_FILE}"

# All Penny background events share one queue; the processor routes by type.
aws_ls events put-rule \
  --name "penny-workflow-all" \
  --event-bus-name "${BUS_NAME}" \
  --event-pattern '{"source":[{"prefix":"penny."}]}' \
  --state ENABLED >/dev/null

aws_ls events put-targets \
  --event-bus-name "${BUS_NAME}" \
  --rule "penny-workflow-all" \
  --targets "Id=workflow-sqs,Arn=${WORK_ARN}" >/dev/null

echo
echo "Provisioned LocalStack resources"
echo "  event bus:     ${BUS_NAME}"
echo "  s3:            s3://${BUCKET}"
echo "  queue:         ${WORK_Q}"
echo "  dlq:           ${WORK_DLQ}"
echo "  rule:          penny-workflow-all (source prefix penny.)"
echo
echo "Queue URL:"
echo "  ${WORK_URL}"
