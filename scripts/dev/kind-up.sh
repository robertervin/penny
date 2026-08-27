#!/usr/bin/env bash
# Create (or reuse) the local kind cluster and deploy LocalStack.
set -euo pipefail

PENNY_BIN="${PENNY_BIN:-${HOME}/.local/bin}"
export PATH="${PENNY_BIN}:${PATH}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLUSTER_NAME="penny"
KIND_CONFIG="${ROOT}/deploy/local/kind-cluster.yaml"

command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
command -v kind >/dev/null || { echo "kind is required; ./scripts/dev/install-prereqs.sh" >&2; exit 1; }
command -v kubectl >/dev/null || { echo "kubectl is required; ./scripts/dev/install-prereqs.sh" >&2; exit 1; }

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running" >&2
  exit 1
fi

if kind get clusters 2>/dev/null | grep -qx "${CLUSTER_NAME}"; then
  echo "kind cluster '${CLUSTER_NAME}' already exists"
else
  echo "creating kind cluster '${CLUSTER_NAME}'"
  kind create cluster --config "${KIND_CONFIG}"
fi

kubectl cluster-info --context "kind-${CLUSTER_NAME}" >/dev/null
kubectl apply -f "${ROOT}/deploy/local/namespace.yaml"
kubectl apply -f "${ROOT}/deploy/local/localstack.yaml"
kubectl apply -f "${ROOT}/deploy/local/postgres.yaml"
echo "waiting for LocalStack to be ready..."
kubectl --context "kind-${CLUSTER_NAME}" -n penny rollout status deployment/localstack --timeout=180s
kubectl --context "kind-${CLUSTER_NAME}" -n penny wait --for=condition=ready pod -l app=localstack --timeout=180s
echo "waiting for Postgres to be ready..."
kubectl --context "kind-${CLUSTER_NAME}" -n penny rollout status statefulset/postgres --timeout=180s
kubectl --context "kind-${CLUSTER_NAME}" -n penny wait --for=condition=ready pod -l app=postgres --timeout=180s

echo
echo "Cluster is up. LocalStack → localhost:4566, Postgres → localhost:5432"
echo "Provision EventBridge/SQS/S3:"
echo "  ./scripts/dev/provision-localstack.sh"
echo
echo "kubectl context: kind-${CLUSTER_NAME}"
echo "  kubectl -n penny get pods"
