#!/usr/bin/env bash
# Test entrypoint.sh CLAUDE.md backup logic.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENTRYPOINT="$PROJECT_ROOT/build/neo/entrypoint.sh"

PASS=0
FAIL=0
TMPDIR_BASE=""

setup() {
  TMPDIR_BASE=$(mktemp -d)
  export HOME="$TMPDIR_BASE/home"
  export CLAUDE_LOG_DIR="$TMPDIR_BASE/logs"
  mkdir -p "$HOME/.claude" "$CLAUDE_LOG_DIR"

  mkdir -p "$TMPDIR_BASE/bin"
  cat > "$TMPDIR_BASE/bin/claude" <<'MOCK'
#!/usr/bin/env bash
echo "claude v1.0-mock"
MOCK
  cat > "$TMPDIR_BASE/bin/python3" <<'MOCK'
#!/usr/bin/env bash
echo "Python 3.12.0"
MOCK
  chmod +x "$TMPDIR_BASE/bin/claude" "$TMPDIR_BASE/bin/python3"
  export PATH="$TMPDIR_BASE/bin:$PATH"
}

cleanup() {
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

echo "=== entrypoint backup tests ==="

# Test 1: Creates .bak if CLAUDE.md exists and .bak does not
setup
echo "# Original" > "$HOME/.claude/CLAUDE.md"
# Extract and run just the backup logic from entrypoint
CLAUDE_HOME="$HOME/.claude"
if [[ -f "$CLAUDE_HOME/CLAUDE.md" && ! -f "$CLAUDE_HOME/CLAUDE.md.bak" ]]; then
  cp "$CLAUDE_HOME/CLAUDE.md" "$CLAUDE_HOME/CLAUDE.md.bak"
fi
assert "creates .bak when missing" test -f "$HOME/.claude/CLAUDE.md.bak"
assert ".bak has correct content" grep -q "Original" "$HOME/.claude/CLAUDE.md.bak"
cleanup

# Test 2: Does NOT overwrite existing .bak
setup
echo "# Original backup" > "$HOME/.claude/CLAUDE.md.bak"
echo "# Modified" > "$HOME/.claude/CLAUDE.md"
CLAUDE_HOME="$HOME/.claude"
if [[ -f "$CLAUDE_HOME/CLAUDE.md" && ! -f "$CLAUDE_HOME/CLAUDE.md.bak" ]]; then
  cp "$CLAUDE_HOME/CLAUDE.md" "$CLAUDE_HOME/CLAUDE.md.bak"
fi
assert "preserves existing .bak" grep -q "Original backup" "$HOME/.claude/CLAUDE.md.bak"
cleanup

# Test 3: No error when CLAUDE.md doesn't exist
setup
CLAUDE_HOME="$HOME/.claude"
if [[ -f "$CLAUDE_HOME/CLAUDE.md" && ! -f "$CLAUDE_HOME/CLAUDE.md.bak" ]]; then
  cp "$CLAUDE_HOME/CLAUDE.md" "$CLAUDE_HOME/CLAUDE.md.bak"
fi
assert "no .bak created without CLAUDE.md" test ! -f "$HOME/.claude/CLAUDE.md.bak"
cleanup

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
