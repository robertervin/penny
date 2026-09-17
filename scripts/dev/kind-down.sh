#!/usr/bin/env bash
# Delete the local kind cluster (LocalStack data in emptyDir is lost).
set -euo pipefail

PENNY_BIN="${PENNY_BIN:-${HOME}/.local/bin}"
export PATH="${PENNY_BIN}:${PATH}"

CLUSTER_NAME="penny"
command -v kind >/dev/null || { echo "kind is required" >&2; exit 1; }

if kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  kind delete cluster --name "${CLUSTER_NAME}"
  echo "deleted kind cluster ${CLUSTER_NAME}"
else
  echo "kind cluster ${CLUSTER_NAME} does not exist"
fi
