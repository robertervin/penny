#!/usr/bin/env bash
# Restart the full Penny local stack (Mac / laptop).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

"$ROOT_DIR/scripts/dev/link-stack-stop.sh"
echo ""
exec "$ROOT_DIR/scripts/dev/link-stack-start.sh"
