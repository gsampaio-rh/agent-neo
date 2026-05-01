#!/usr/bin/env bash
# Test claude-logged wrapper with a mock claude command.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLAUDE_LOGGED="$PROJECT_ROOT/build/neo/claude-logged"
PASS=0
FAIL=0

assert_pass() {
  local desc="$1"; shift
  if "$@"; then
    echo "  PASS: $desc"; PASS=$((PASS+1))
  else
    echo "  FAIL: $desc"; FAIL=$((FAIL+1))
  fi
}

assert_not() {
  local desc="$1"; shift
  if "$@"; then
    echo "  FAIL: $desc (expected to fail)"; FAIL=$((FAIL+1))
  else
    echo "  PASS: $desc"; PASS=$((PASS+1))
  fi
}

echo "=== claude-logged tests ==="

# Test 1: Fresh session (no --continue)
TMPD=$(mktemp -d)
export CLAUDE_LOG_DIR="$TMPD"
touch "$TMPD/claude.jsonl"
MOCK_BIN="$TMPD/bin"
mkdir -p "$MOCK_BIN"
ARGS_LOG="$TMPD/claude-args.log"
cat > "$MOCK_BIN/claude" <<MOCK
#!/usr/bin/env bash
echo "\$*" >> "$ARGS_LOG"
echo '{"type":"system","subtype":"init"}'
MOCK
chmod +x "$MOCK_BIN/claude"
PATH="$MOCK_BIN:$PATH" bash "$CLAUDE_LOGGED" "test prompt" 2>"$TMPD/stderr.log" || true
assert_not "does NOT use --continue on fresh session" grep -q -- '--continue' "$ARGS_LOG"
assert_pass "creates .session-started marker" test -f "$TMPD/.session-started"
assert_pass "produces structured log output" grep -q '\[claude-logged' "$TMPD/stderr.log"
assert_pass "tees output to log file" test -s "$TMPD/claude.jsonl"
rm -rf "$TMPD"

# Test 2: Continuing session (with --continue)
TMPD=$(mktemp -d)
export CLAUDE_LOG_DIR="$TMPD"
touch "$TMPD/claude.jsonl" "$TMPD/.session-started"
MOCK_BIN="$TMPD/bin"
mkdir -p "$MOCK_BIN"
ARGS_LOG="$TMPD/claude-args.log"
cat > "$MOCK_BIN/claude" <<MOCK
#!/usr/bin/env bash
echo "\$*" >> "$ARGS_LOG"
echo '{"type":"system","subtype":"init"}'
MOCK
chmod +x "$MOCK_BIN/claude"
PATH="$MOCK_BIN:$PATH" bash "$CLAUDE_LOGGED" "second prompt" 2>"$TMPD/stderr.log" || true
assert_pass "uses --continue on existing session" grep -q -- '--continue' "$ARGS_LOG"
assert_pass "logs 'Continuing existing session'" grep -q 'Continuing existing session' "$TMPD/stderr.log"
rm -rf "$TMPD"

# Test 3: Permission mode
TMPD=$(mktemp -d)
export CLAUDE_LOG_DIR="$TMPD"
touch "$TMPD/claude.jsonl"
MOCK_BIN="$TMPD/bin"
mkdir -p "$MOCK_BIN"
ARGS_LOG="$TMPD/claude-args.log"
cat > "$MOCK_BIN/claude" <<MOCK
#!/usr/bin/env bash
echo "\$*" >> "$ARGS_LOG"
echo '{}'
MOCK
chmod +x "$MOCK_BIN/claude"
CLAUDE_PERMISSION_MODE="dangerously-skip-permissions" PATH="$MOCK_BIN:$PATH" bash "$CLAUDE_LOGGED" "test" 2>/dev/null || true
assert_pass "passes dangerously-skip-permissions flag" grep -q 'dangerously-skip-permissions' "$ARGS_LOG"
rm -rf "$TMPD"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
