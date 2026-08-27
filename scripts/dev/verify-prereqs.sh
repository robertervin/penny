#!/usr/bin/env bash
# Check tools needed to run Penny workers on local Kubernetes + LocalStack.
set -euo pipefail

PENNY_BIN="${PENNY_BIN:-${HOME}/.local/bin}"
export PATH="${PENNY_BIN}:${PATH}"

ok=0
fail=0

check() {
  local name="$1"
  shift
  if "$@"; then
    printf 'ok    %s\n' "${name}"
    ok=$((ok + 1))
  else
    printf 'FAIL  %s\n' "${name}"
    fail=$((fail + 1))
  fi
}

check "docker on PATH" bash -c 'command -v docker >/dev/null'
check "docker daemon" bash -c 'docker info >/dev/null 2>&1'
check "kubectl on PATH" bash -c 'command -v kubectl >/dev/null'
check "kind on PATH" bash -c 'command -v kind >/dev/null'
check "helm on PATH" bash -c 'command -v helm >/dev/null'
check "aws on PATH" bash -c 'command -v aws >/dev/null'

if command -v kubectl >/dev/null; then
  check "kubectl version client" bash -c 'kubectl version --client >/dev/null'
fi
if command -v kind >/dev/null; then
  check "kind version" bash -c 'kind version >/dev/null'
fi
if command -v helm >/dev/null; then
  check "helm version" bash -c 'helm version --short >/dev/null'
fi
if command -v aws >/dev/null; then
  check "aws cli v2" bash -c 'aws --version 2>&1 | grep -q "aws-cli/2"'
fi

printf '\n%s passed, %s failed\n' "${ok}" "${fail}"
if [[ "${fail}" -ne 0 ]]; then
  printf 'Run ./scripts/dev/install-prereqs.sh (and start Docker).\n' >&2
  exit 1
fi
