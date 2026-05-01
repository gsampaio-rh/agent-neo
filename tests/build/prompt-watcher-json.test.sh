#!/usr/bin/env bash
# Test prompt-watcher.sh rejects invalid JSON instead of passing raw file content.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WATCHER="$PROJECT_ROOT/build/neo/prompt-watcher.sh"

PASS=0
FAIL=0
TMPDIR_BASE=""
WATCHER_PID=""

setup() {
  TMPDIR_BASE=$(mktemp -d)
  export CLAUDE_LOG_DIR="$TMPDIR_BASE"
  touch "$TMPDIR_BASE/claude.jsonl"

  mkdir -p "$TMPDIR_BASE/bin"
  cat > "$TMPDIR_BASE/bin/claude-logged" <<'MOCK'
#!/usr/bin/env bash
echo "MOCK_CALLED: $*" >> "$CLAUDE_LOG_DIR/mock.log"
sleep 0.2
MOCK
  chmod +x "$TMPDIR_BASE/bin/claude-logged"
  export PATH="$TMPDIR_BASE/bin:$PATH"
}

cleanup() {
  if [[ -n "${WATCHER_PID:-}" ]]; then
    kill "$WATCHER_PID" 2>/dev/null || true
    wait "$WATCHER_PID" 2>/dev/null || true
    WATCHER_PID=""
  fi
  [[ -n "${TMPDIR_BASE:-}" ]] && rm -rf "$TMPDIR_BASE"
}
trap cleanup EXIT

assert() {
  local desc="$1"; shift
  if "$@"; then
    echo "  PASS: $desc"; PASS=$((PASS+1))
  else
    echo "  FAIL: $desc"; FAIL=$((FAIL+1))
  fi
}

echo "=== prompt-watcher JSON validation tests ==="

# Test 1: Valid JSON is processed normally
setup
bash "$WATCHER" &>"$TMPDIR_BASE/watcher.log" &
WATCHER_PID=$!
sleep 0.5
echo '{"prompt":"valid prompt"}' > "$TMPDIR_BASE/prompt.json"
sleep 2
kill "$WATCHER_PID" 2>/dev/null || true
wait "$WATCHER_PID" 2>/dev/null || true
WATCHER_PID=""
assert "valid JSON triggers claude-logged" test -f "$TMPDIR_BASE/mock.log"
assert "valid prompt.json is consumed" test ! -f "$TMPDIR_BASE/prompt.json"
cleanup

# Test 2: Invalid JSON is rejected (not passed to agent)
setup
bash "$WATCHER" &>"$TMPDIR_BASE/watcher.log" &
WATCHER_PID=$!
sleep 0.5
echo 'THIS IS NOT JSON' > "$TMPDIR_BASE/prompt.json"
sleep 2
kill "$WATCHER_PID" 2>/dev/null || true
wait "$WATCHER_PID" 2>/dev/null || true
WATCHER_PID=""
assert "invalid JSON does NOT trigger claude-logged" test ! -f "$TMPDIR_BASE/mock.log"
assert "invalid prompt.json is removed" test ! -f "$TMPDIR_BASE/prompt.json"
assert "error logged" grep -q "ERROR.*Failed to parse" "$TMPDIR_BASE/watcher.log"
cleanup

# Test 3: JSON missing 'prompt' field is rejected
setup
bash "$WATCHER" &>"$TMPDIR_BASE/watcher.log" &
WATCHER_PID=$!
sleep 0.5
echo '{"wrong_field":"value"}' > "$TMPDIR_BASE/prompt.json"
sleep 2
kill "$WATCHER_PID" 2>/dev/null || true
wait "$WATCHER_PID" 2>/dev/null || true
WATCHER_PID=""
assert "missing prompt field does NOT trigger claude-logged" test ! -f "$TMPDIR_BASE/mock.log"
cleanup

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
