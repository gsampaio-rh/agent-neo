#!/usr/bin/env bash
# Dockerfile test: build UI image and verify expected paths.
# Requires docker or podman.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
UI_DIR="$PROJECT_ROOT/ui"
IMAGE_NAME="neo-ui-test:$$"
PASS=0
FAIL=0

runtime=""
if command -v docker &>/dev/null; then runtime=docker;
elif command -v podman &>/dev/null; then runtime=podman;
else echo "SKIP: no docker or podman found"; exit 0; fi

cleanup() { $runtime rmi "$IMAGE_NAME" 2>/dev/null || true; }
trap cleanup EXIT

assert() {
  local desc="$1"; shift
  if "$@" &>/dev/null; then
    echo "  PASS: $desc"; PASS=$((PASS+1))
  else
    echo "  FAIL: $desc"; FAIL=$((FAIL+1))
  fi
}

echo "Building UI image..."
$runtime build -t "$IMAGE_NAME" "$UI_DIR" --quiet

echo ""
echo "=== UI image tests ==="
assert "relay.mjs exists" $runtime run --rm "$IMAGE_NAME" test -f /app/relay.mjs
assert "relay/ directory exists" $runtime run --rm "$IMAGE_NAME" test -d /app/relay
assert "relay/config.js exists" $runtime run --rm "$IMAGE_NAME" test -f /app/relay/config.js
assert "relay/router.js exists" $runtime run --rm "$IMAGE_NAME" test -f /app/relay/router.js
assert "relay/sse/hub.js exists" $runtime run --rm "$IMAGE_NAME" test -f /app/relay/sse/hub.js
assert "dist/ directory exists" $runtime run --rm "$IMAGE_NAME" test -d /app/dist
assert "dist/index.html exists" $runtime run --rm "$IMAGE_NAME" test -f /app/dist/index.html
assert "node available" $runtime run --rm "$IMAGE_NAME" node --version

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
