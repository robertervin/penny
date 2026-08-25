#!/usr/bin/env bash
# Install host tools for local Kubernetes + LocalStack (EventBridge/SQS).
# Does not install Docker. Requires: bash, curl, unzip (Linux AWS CLI).
set -euo pipefail

PENNY_BIN="${PENNY_BIN:-${HOME}/.local/bin}"
KUBECTL_VERSION="${KUBECTL_VERSION:-v1.31.4}"
KIND_VERSION="${KIND_VERSION:-v0.27.0}"
HELM_VERSION="${HELM_VERSION:-v3.16.4}"

log() { printf '%s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

os="$(uname -s)"
arch="$(uname -m)"

case "${os}" in
  Darwin) os_dl="darwin" ;;
  Linux) os_dl="linux" ;;
  *) die "unsupported OS: ${os} (need macOS or Linux)" ;;
esac

case "${arch}" in
  x86_64|amd64) arch_dl="amd64" ;;
  arm64|aarch64) arch_dl="arm64" ;;
  *) die "unsupported arch: ${arch}" ;;
esac

mkdir -p "${PENNY_BIN}"

warn_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log "warn: Docker is not installed. Install Docker Desktop (macOS) or Docker Engine (Linux) before ./scripts/dev/kind-up.sh"
    return
  fi
  if ! docker info >/dev/null 2>&1; then
    log "warn: Docker is installed but the daemon is not usable yet. Start it before ./scripts/dev/kind-up.sh"
  fi
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

install_kubectl() {
  if have_cmd kubectl; then
    log "kubectl already on PATH: $(command -v kubectl)"
    return
  fi
  if [[ -x "${PENNY_BIN}/kubectl" ]]; then
    log "kubectl already at ${PENNY_BIN}/kubectl"
    return
  fi
  log "installing kubectl ${KUBECTL_VERSION} → ${PENNY_BIN}/kubectl"
  curl -fsSL -o "${PENNY_BIN}/kubectl" \
    "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/${os_dl}/${arch_dl}/kubectl"
  chmod +x "${PENNY_BIN}/kubectl"
}

install_kind() {
  if have_cmd kind; then
    log "kind already on PATH: $(command -v kind)"
    return
  fi
  if [[ -x "${PENNY_BIN}/kind" ]]; then
    log "kind already at ${PENNY_BIN}/kind"
    return
  fi
  log "installing kind ${KIND_VERSION} → ${PENNY_BIN}/kind"
  curl -fsSL -o "${PENNY_BIN}/kind" \
    "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-${os_dl}-${arch_dl}"
  chmod +x "${PENNY_BIN}/kind"
}

install_helm() {
  if have_cmd helm; then
    log "helm already on PATH: $(command -v helm)"
    return
  fi
  if [[ -x "${PENNY_BIN}/helm" ]]; then
    log "helm already at ${PENNY_BIN}/helm"
    return
  fi
  log "installing helm ${HELM_VERSION} → ${PENNY_BIN}/helm"
  local work tgz
  work="$(mktemp -d)"
  tgz="${work}/helm.tgz"
  curl -fsSL -o "${tgz}" \
    "https://get.helm.sh/helm-${HELM_VERSION}-${os_dl}-${arch_dl}.tar.gz"
  tar -xzf "${tgz}" -C "${work}"
  mv "${work}/${os_dl}-${arch_dl}/helm" "${PENNY_BIN}/helm"
  rm -rf "${work}"
  chmod +x "${PENNY_BIN}/helm"
}

install_awscli() {
  if have_cmd aws; then
    log "aws already on PATH: $(command -v aws)"
    return
  fi
  if [[ -x "${PENNY_BIN}/aws" ]]; then
    log "aws already at ${PENNY_BIN}/aws"
    return
  fi

  if [[ "${os}" == "Darwin" ]] && have_cmd brew; then
    log "installing awscli via Homebrew"
    brew install awscli
    return
  fi

  if [[ "${os}" != "Linux" ]]; then
    die "install AWS CLI v2 from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
  fi

  have_cmd unzip || die "unzip is required to install AWS CLI on Linux (e.g. apt-get install unzip)"

  log "installing AWS CLI v2 into ${PENNY_BIN} (no sudo)"
  local work
  work="$(mktemp -d)"
  local zip_arch="x86_64"
  [[ "${arch_dl}" == "arm64" ]] && zip_arch="aarch64"
  curl -fsSL -o "${work}/awscliv2.zip" \
    "https://awscli.amazonaws.com/awscli-exe-linux-${zip_arch}.zip"
  unzip -q "${work}/awscliv2.zip" -d "${work}"
  "${work}/aws/install" --install-dir "${HOME}/.local/aws-cli" --bin-dir "${PENNY_BIN}" --update
  rm -rf "${work}"
}

warn_docker
install_kubectl
install_kind
install_helm
install_awscli

# PATH hint
case ":${PATH}:" in
  *":${PENNY_BIN}:"*) ;;
  *)
    log ""
    log "Add ${PENNY_BIN} to PATH, e.g.:"
    log "  export PATH=\"${PENNY_BIN}:\$PATH\""
    ;;
esac

log ""
log "Prerequisites installed. Next:"
log "  ./scripts/dev/verify-prereqs.sh"
log "  ./scripts/dev/kind-up.sh"
log "  ./scripts/dev/provision-localstack.sh"
