#!/usr/bin/env bash
# Test isolation-check.sh output format: runs the script and validates the JSON
# structure in isolation-state.json.
#
# On macOS/dev the script detects runc (no Kata signals present). The test
# validates the output schema regardless of the runtime detected.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHECKER="$PROJECT_ROOT/build/isolation-check.sh"
PASS=0
FAIL=0
TMPDIR_BASE=""

setup() {
  TMPDIR_BASE=$(mktemp -d)
  export CLAUDE_LOG_DIR="$TMPDIR_BASE"
}

cleanup() {
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

echo "=== isolation-check tests ==="

setup
bash "$CHECKER" > /dev/null 2>&1

# Test 1: isolation-state.json is created
assert_pass "isolation-state.json is created" test -f "$TMPDIR_BASE/isolation-state.json"

# Test 2: output is valid JSON with expected schema
assert_pass "output is valid JSON with correct schema" python3 -c "
import json, sys
with open('$TMPDIR_BASE/isolation-state.json') as f:
    data = json.load(f)

assert 'timestamp' in data, 'missing timestamp'
assert 'runtime' in data, 'missing runtime'
assert isinstance(data['runtime'], str), 'runtime is not string'
assert data['runtime'] in ('runc', 'kata'), f'runtime is {data[\"runtime\"]}, expected runc or kata'
assert 'score' in data, 'missing score'
assert isinstance(data['score'], int), 'score is not int'

assert 'checks' in data, 'missing checks'
assert isinstance(data['checks'], list), 'checks is not list'
assert len(data['checks']) == 4, f'expected 4 checks, got {len(data[\"checks\"])}'

expected_names = {'kata_cmdline', 'block_devices', 'acpi_tables', 'boot_image'}
actual_names = set()
for check in data['checks']:
    assert 'name' in check, 'check missing name'
    assert 'label' in check, 'check missing label'
    assert 'pass' in check, 'check missing pass'
    assert 'detail' in check, 'check missing detail'
    assert isinstance(check['name'], str), f'check.name is not string: {check[\"name\"]}'
    assert isinstance(check['label'], str), f'check.label is not string: {check[\"label\"]}'
    assert isinstance(check['pass'], bool), f'check.pass is not bool: {check[\"pass\"]}'
    assert isinstance(check['detail'], str), f'check.detail is not string: {check[\"detail\"]}'
    assert len(check['detail']) > 10, f'check.detail is too short: {check[\"detail\"]}'
    actual_names.add(check['name'])

assert actual_names == expected_names, f'unexpected check names: {actual_names}'
"

# Test 3: runtime is kata iff score >= 3
assert_pass "runtime matches score threshold" python3 -c "
import json
with open('$TMPDIR_BASE/isolation-state.json') as f:
    data = json.load(f)
if data['score'] >= 3:
    assert data['runtime'] == 'kata', f'score={data[\"score\"]} but runtime is {data[\"runtime\"]}'
else:
    assert data['runtime'] == 'runc', f'score={data[\"score\"]} but runtime is {data[\"runtime\"]}'
"

# Test 4: no leftover .tmp file (atomic write)
assert_pass "no leftover .tmp file" test ! -f "$TMPDIR_BASE/isolation-state.json.tmp"

cleanup

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
