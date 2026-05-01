#!/usr/bin/env bash
# Test net-monitor.sh output format: runs one iteration and validates the JSON
# structure in net-state.json.
#
# Requires either `ss` (Linux) or `/proc/net/tcp`. On macOS (no ss, no procfs),
# the test creates a shim `ss` that returns empty output so the script can run.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MONITOR="$PROJECT_ROOT/build/neo/net-monitor.sh"
PASS=0
FAIL=0
TMPDIR_BASE=""
MON_PID=""

setup() {
  TMPDIR_BASE=$(mktemp -d)
  export CLAUDE_LOG_DIR="$TMPDIR_BASE"
  export NET_MONITOR_INTERVAL=1

  # On systems without ss or /proc/net/tcp (e.g. macOS), provide a shim
  if ! command -v ss &>/dev/null && [[ ! -f /proc/net/tcp ]]; then
    mkdir -p "$TMPDIR_BASE/bin"
    cat > "$TMPDIR_BASE/bin/ss" <<'SHIM'
#!/usr/bin/env bash
# No-op shim — returns empty output so net-monitor.sh can run
exit 0
SHIM
    chmod +x "$TMPDIR_BASE/bin/ss"
    export PATH="$TMPDIR_BASE/bin:$PATH"
  fi
}

cleanup() {
  if [[ -n "${MON_PID:-}" ]]; then
    kill "$MON_PID" 2>/dev/null || true
    wait "$MON_PID" 2>/dev/null || true
    MON_PID=""
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

echo "=== net-monitor tests ==="

setup
bash "$MONITOR" &>"$TMPDIR_BASE/monitor.log" &
MON_PID=$!
sleep 3

# Test 1: net-state.json is created
assert_pass "net-state.json is created" test -f "$TMPDIR_BASE/net-state.json"

# Test 2: output is valid JSON with expected structure
assert_pass "output is valid JSON with correct schema" python3 -c "
import json, sys
with open('$TMPDIR_BASE/net-state.json') as f:
    data = json.load(f)

assert 'timestamp' in data, 'missing timestamp'

assert 'bindShell' in data, 'missing bindShell'
assert 'listening' in data['bindShell'], 'missing bindShell.listening'
assert 'established' in data['bindShell'], 'missing bindShell.established'

assert 'outbound' in data, 'missing outbound'
assert 'k8sApi' in data['outbound'], 'missing outbound.k8sApi'
assert 'collector' in data['outbound'], 'missing outbound.collector'

for key in ['listening', 'established']:
    assert isinstance(data['bindShell'][key], bool), f'bindShell.{key} is not bool'
for key in ['k8sApi', 'collector']:
    assert isinstance(data['outbound'][key], bool), f'outbound.{key} is not bool'
"

# Test 3: in idle state, all flags should be false
assert_pass "idle state has all false flags" python3 -c "
import json
with open('$TMPDIR_BASE/net-state.json') as f:
    data = json.load(f)
assert data['bindShell']['listening'] == False
assert data['bindShell']['established'] == False
assert data['outbound']['k8sApi'] == False
assert data['outbound']['collector'] == False
"

# Test 4: tmp file is cleaned up (atomic write)
assert_pass "no leftover .tmp file" test ! -f "$TMPDIR_BASE/net-state.json.tmp"

kill "$MON_PID" 2>/dev/null || true
wait "$MON_PID" 2>/dev/null || true
MON_PID=""
cleanup

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
