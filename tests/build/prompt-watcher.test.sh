#!/usr/bin/env bash
# Test prompt-watcher.sh state machine using a temp dir and mock claude-logged.
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
  export PATH="$TMPDIR_BASE/bin:$PATH"
}

set_mock_fast() {
  cat > "$TMPDIR_BASE/bin/claude-logged" <<'MOCK'
#!/usr/bin/env bash
echo "MOCK_CALLED: $*" >> "$CLAUDE_LOG_DIR/mock.log"
sleep 0.3
MOCK
  chmod +x "$TMPDIR_BASE/bin/claude-logged"
}

set_mock_slow() {
  cat > "$TMPDIR_BASE/bin/claude-logged" <<'MOCK'
#!/usr/bin/env bash
echo "MOCK_STARTED" >> "$CLAUDE_LOG_DIR/mock.log"
sleep 60
MOCK
  chmod +x "$TMPDIR_BASE/bin/claude-logged"
}

cleanup() {
  if [[ -n "${WATCHER_PID:-}" ]]; then
    kill "$WATCHER_PID" 2>/dev/null || true
    wait "$WATCHER_PID" 2>/dev/null || true
    WATCHER_PID=""
  fi
  [[ -n "${TMPDIR_BASE:-}" ]] && rm -rf "$TMPDIR_BASE"
  TMPDIR_BASE=""
}
trap cleanup EXIT

assert_pass() {
  local desc="$1"; shift
  if "$@"; then
    echo "  PASS: $desc"; PASS=$((PASS+1))
  else
    echo "  FAIL: $desc"; FAIL=$((FAIL+1))
  fi
}

assert_fail() {
  local desc="$1"; shift
  if "$@"; then
    echo "  FAIL: $desc (expected failure)"; FAIL=$((FAIL+1))
  else
    echo "  PASS: $desc"; PASS=$((PASS+1))
  fi
}

start_watcher() {
  bash "$WATCHER" &>"$TMPDIR_BASE/watcher.log" &
  WATCHER_PID=$!
  sleep 0.5
}

stop_watcher() {
  kill "$WATCHER_PID" 2>/dev/null || true
  wait "$WATCHER_PID" 2>/dev/null || true
  WATCHER_PID=""
}

echo "=== prompt-watcher tests ==="

# Test 1: prompt.json triggers execution
setup
set_mock_fast
start_watcher
echo '{"prompt":"test prompt"}' > "$TMPDIR_BASE/prompt.json"
sleep 2
stop_watcher
assert_pass "prompt.json triggers claude-logged" test -f "$TMPDIR_BASE/mock.log"
assert_fail "prompt.running is cleaned up" test -f "$TMPDIR_BASE/prompt.running"
assert_fail "prompt.json is consumed" test -f "$TMPDIR_BASE/prompt.json"
cleanup

# Test 2: prompt.reset clears session
setup
set_mock_fast
touch "$TMPDIR_BASE/.session-started"
echo "existing log data" > "$TMPDIR_BASE/claude.jsonl"
start_watcher
touch "$TMPDIR_BASE/prompt.reset"
sleep 2
stop_watcher
assert_fail "prompt.reset clears .session-started" test -f "$TMPDIR_BASE/.session-started"
assert_fail "prompt.reset clears log file" test -s "$TMPDIR_BASE/claude.jsonl"
assert_fail "prompt.reset file is consumed" test -f "$TMPDIR_BASE/prompt.reset"
cleanup

# Test 3: prompt.stop works when agent is idle (consumed in loop iteration)
setup
set_mock_fast
start_watcher
touch "$TMPDIR_BASE/prompt.stop"
sleep 2
stop_watcher
assert_fail "prompt.stop file is consumed" test -f "$TMPDIR_BASE/prompt.stop"
cleanup

# Test 4: agent.pid file is created during execution
setup
set_mock_slow
start_watcher
echo '{"prompt":"quick task"}' > "$TMPDIR_BASE/prompt.json"
sleep 3
assert_pass "agent.pid exists during slow execution" test -f "$TMPDIR_BASE/agent.pid"
assert_pass "prompt.running exists during slow execution" test -f "$TMPDIR_BASE/prompt.running"
stop_watcher
cleanup

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
