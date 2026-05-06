#!/usr/bin/env bash
# Smoke tests for scripts/config.sh sourcing, .env loading, and validate_config.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG="$PROJECT_ROOT/scripts/config.sh"
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

assert_fail() {
  local desc="$1"; shift
  if "$@"; then
    echo "  FAIL: $desc (expected failure)"; FAIL=$((FAIL+1))
  else
    echo "  PASS: $desc"; PASS=$((PASS+1))
  fi
}

echo "=== config.sh smoke tests ==="

# Test 1: Sourcing sets default variables
(
  unset NAMESPACE RELEASE_NAME MODEL_NAME ANTHROPIC_BASE_URL
  source "$CONFIG"
  [[ "$NAMESPACE" == "agent-namespace" ]] || exit 1
  [[ "$RELEASE_NAME" == "neo" ]] || exit 1
  [[ "$MODEL_NAME" == "glm47-flash" ]] || exit 1
)
assert_pass "default NAMESPACE is agent-namespace" test $? -eq 0

(
  source "$CONFIG"
  [[ "$RELEASE_NAME" == "neo" ]]
)
assert_pass "default RELEASE_NAME is neo" test $? -eq 0

(
  source "$CONFIG"
  [[ "$AGENT_BC_NAME" == "neo-agent" ]]
)
assert_pass "default AGENT_BC_NAME is neo-agent" test $? -eq 0

(
  source "$CONFIG"
  [[ "$UI_BC_NAME" == "neo-ui" ]]
)
assert_pass "default UI_BC_NAME is neo-ui" test $? -eq 0

# Test 2: .env loading overrides
TMPD=$(mktemp -d)
# Temporarily create a .env file in the project root
ENV_EXISTED=false
if [[ -f "$PROJECT_ROOT/.env" ]]; then
  ENV_EXISTED=true
  cp "$PROJECT_ROOT/.env" "$TMPD/env-backup"
fi

echo 'NAMESPACE=test-ns' > "$PROJECT_ROOT/.env"
echo 'ANTHROPIC_BASE_URL=http://test.com' >> "$PROJECT_ROOT/.env"
(
  unset NAMESPACE ANTHROPIC_BASE_URL
  source "$CONFIG"
  [[ "$NAMESPACE" == "test-ns" ]]
)
assert_pass ".env loading overrides NAMESPACE" test $? -eq 0
(
  unset ANTHROPIC_BASE_URL
  source "$CONFIG"
  [[ "$ANTHROPIC_BASE_URL" == "http://test.com" ]]
)
assert_pass ".env loading sets ANTHROPIC_BASE_URL" test $? -eq 0

# Restore .env
if $ENV_EXISTED; then
  cp "$TMPD/env-backup" "$PROJECT_ROOT/.env"
else
  rm -f "$PROJECT_ROOT/.env"
fi
rm -rf "$TMPD"

# Test 3: validate_config fails when ANTHROPIC_BASE_URL empty
(
  unset ANTHROPIC_BASE_URL
  # Remove .env if present to avoid loading it
  _env="$PROJECT_ROOT/.env"
  [[ -f "$_env" ]] && _had_env=true && mv "$_env" "$_env.bak"
  source "$CONFIG"
  validate_config 2>/dev/null
  rc=$?
  [[ "${_had_env:-}" == "true" ]] && mv "$_env.bak" "$_env"
  exit $rc
)
assert_fail "validate_config fails when ANTHROPIC_BASE_URL empty" test $? -eq 0

# Test 4: validate_config succeeds when ANTHROPIC_BASE_URL set
(
  export ANTHROPIC_BASE_URL="http://valid.url.com"
  _env="$PROJECT_ROOT/.env"
  [[ -f "$_env" ]] && _had_env=true && mv "$_env" "$_env.bak"
  source "$CONFIG"
  validate_config 2>/dev/null
  rc=$?
  [[ "${_had_env:-}" == "true" ]] && mv "$_env.bak" "$_env"
  exit $rc
)
assert_pass "validate_config succeeds when ANTHROPIC_BASE_URL set" test $? -eq 0

# Test 5: BUILD_MODE defaults to git
(
  unset BUILD_MODE
  _env="$PROJECT_ROOT/.env"
  [[ -f "$_env" ]] && _had_env=true && mv "$_env" "$_env.bak"
  source "$CONFIG"
  [[ "${_had_env:-}" == "true" ]] && mv "$_env.bak" "$_env"
  [[ "$BUILD_MODE" == "git" ]]
)
assert_pass "default BUILD_MODE is git" test $? -eq 0

# Test 6: BUILD_MODE respects override
(
  export BUILD_MODE="binary"
  _env="$PROJECT_ROOT/.env"
  [[ -f "$_env" ]] && _had_env=true && mv "$_env" "$_env.bak"
  source "$CONFIG"
  [[ "${_had_env:-}" == "true" ]] && mv "$_env.bak" "$_env"
  [[ "$BUILD_MODE" == "binary" ]]
)
assert_pass "BUILD_MODE override to binary" test $? -eq 0

# Test 7: Environment variable override takes precedence
(
  export NAMESPACE="custom-ns"
  _env="$PROJECT_ROOT/.env"
  [[ -f "$_env" ]] && _had_env=true && mv "$_env" "$_env.bak"
  source "$CONFIG"
  [[ "${_had_env:-}" == "true" ]] && mv "$_env.bak" "$_env"
  [[ "$NAMESPACE" == "custom-ns" ]]
)
assert_pass "env var override takes precedence" test $? -eq 0

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
