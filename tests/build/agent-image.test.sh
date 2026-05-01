#!/usr/bin/env bash
# Dockerfile test: build agent image and verify expected paths/binaries.
# Requires docker or podman.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build/neo"
IMAGE_NAME="neo-agent-test:$$"
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

echo "Building agent image..."
$runtime build -t "$IMAGE_NAME" "$BUILD_DIR" --quiet

echo ""
echo "=== Agent image tests ==="
assert "entrypoint.sh exists" $runtime run --rm "$IMAGE_NAME" test -f /usr/local/bin/entrypoint.sh
assert "claude-logged exists" $runtime run --rm "$IMAGE_NAME" test -f /usr/local/bin/claude-logged
assert "prompt-watcher.sh exists" $runtime run --rm "$IMAGE_NAME" test -f /usr/local/lib/neo/prompt-watcher.sh
assert "entrypoint.sh is executable" $runtime run --rm "$IMAGE_NAME" test -x /usr/local/bin/entrypoint.sh
assert "claude-logged is executable" $runtime run --rm "$IMAGE_NAME" test -x /usr/local/bin/claude-logged
assert "prompt-watcher.sh is executable" $runtime run --rm "$IMAGE_NAME" test -x /usr/local/lib/neo/prompt-watcher.sh
assert "python3 available" $runtime run --rm "$IMAGE_NAME" python3 --version
assert "ttyd available" $runtime run --rm "$IMAGE_NAME" test -x /usr/local/bin/ttyd
assert "curl removed" $runtime run --rm "$IMAGE_NAME" sh -c '! command -v curl'
assert "wget removed" $runtime run --rm "$IMAGE_NAME" sh -c '! command -v wget'
assert "nc removed" $runtime run --rm "$IMAGE_NAME" sh -c '! command -v nc'

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
