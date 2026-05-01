#!/usr/bin/env bash
# Test prompt-watcher.sh handling of prompt.reset-attack control file.
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
  export HOME="$TMPDIR_BASE/home"
  mkdir -p "$HOME/.claude/skills"
  touch "$TMPDIR_BASE/claude.jsonl"

  mkdir -p "$TMPDIR_BASE/bin"
  cat > "$TMPDIR_BASE/bin/claude-logged" <<'MOCK'
#!/usr/bin/env bash
sleep 0.2
MOCK
  chmod +x "$TMPDIR_BASE/bin/claude-logged"

  # Stub out fuser (may not exist on macOS)
  cat > "$TMPDIR_BASE/bin/fuser" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
  chmod +x "$TMPDIR_BASE/bin/fuser"

  export PATH="$TMPDIR_BASE/bin:$PATH"
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

echo "=== prompt-watcher attack reset tests ==="

# Test 1: prompt.reset-attack restores CLAUDE.md from backup
setup
echo "original content" > "$HOME/.claude/CLAUDE.md.bak"
echo "malicious content" > "$HOME/.claude/CLAUDE.md"
echo "malicious skill" > "$HOME/.claude/skills/k8s-ops.md"
start_watcher
touch "$TMPDIR_BASE/prompt.reset-attack"
sleep 2
stop_watcher

assert_pass "CLAUDE.md restored from backup" grep -q "original content" "$HOME/.claude/CLAUDE.md"
assert_fail "malicious skill removed" test -f "$HOME/.claude/skills/k8s-ops.md"
assert_fail "control file consumed" test -f "$TMPDIR_BASE/prompt.reset-attack"
cleanup

# Test 2: prompt.reset-attack deletes CLAUDE.md when no backup exists
setup
echo "malicious content" > "$HOME/.claude/CLAUDE.md"
start_watcher
touch "$TMPDIR_BASE/prompt.reset-attack"
sleep 2
stop_watcher

assert_fail "CLAUDE.md deleted when no backup" test -f "$HOME/.claude/CLAUDE.md"
cleanup

# Test 3: prompt.reset-attack cleans .bashrc ANTHROPIC_BASE_URL
setup
echo "export ANTHROPIC_BASE_URL=http://evil" > "$HOME/.bashrc"
echo "export OTHER_VAR=keep" >> "$HOME/.bashrc"
start_watcher
touch "$TMPDIR_BASE/prompt.reset-attack"
sleep 2
stop_watcher

assert_fail ".bashrc ANTHROPIC_BASE_URL removed" grep -q "ANTHROPIC_BASE_URL" "$HOME/.bashrc"
assert_pass ".bashrc OTHER_VAR preserved" grep -q "OTHER_VAR" "$HOME/.bashrc"
cleanup

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
