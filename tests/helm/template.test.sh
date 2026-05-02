#!/usr/bin/env bash
# Helm template tests — validate chart rendering and resource expectations.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CHART_DIR="$PROJECT_ROOT/chart"
PASS=0
FAIL=0

if ! command -v helm &>/dev/null; then
  echo "SKIP: helm not found"
  exit 0
fi

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

TMPDIR_TEST=$(mktemp -d)
trap "rm -rf $TMPDIR_TEST" EXIT

echo "=== Helm template tests ==="

# Render full template with defaults
helm template test-release "$CHART_DIR" --set config.anthropicBaseUrl=http://test.example.com > "$TMPDIR_TEST/full.yaml" 2>&1
assert_pass "chart renders successfully" test $? -eq 0

# Resource names match neo-* pattern
assert_pass "deployment names contain 'neo'" grep -q 'name: test-release-neo' "$TMPDIR_TEST/full.yaml"

# Expected resource kinds
for kind in Deployment Service Route BuildConfig ImageStream ConfigMap; do
  assert_pass "$kind resource rendered" grep -q "kind: $kind" "$TMPDIR_TEST/full.yaml"
done

# No Secret when ttyd.credential is empty
assert_fail "no Secret when ttyd.credential empty" grep -q "kind: Secret" "$TMPDIR_TEST/full.yaml"

# Secret present when ttyd.credential set
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set ttyd.credential=admin:pass > "$TMPDIR_TEST/secret.yaml" 2>&1
assert_pass "Secret rendered when ttyd.credential set" grep -q "kind: Secret" "$TMPDIR_TEST/secret.yaml"

# Image names from values
assert_pass "agent image name in output" grep -q 'neo-agent' "$TMPDIR_TEST/full.yaml"
assert_pass "UI image name in output" grep -q 'neo-ui' "$TMPDIR_TEST/full.yaml"

# Custom image registry
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set image.registry=my-registry.io > "$TMPDIR_TEST/custom-registry.yaml" 2>&1
assert_pass "custom registry used" grep -q 'my-registry.io' "$TMPDIR_TEST/custom-registry.yaml"

# Model name propagation
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set config.modelName=claude-4 > "$TMPDIR_TEST/model.yaml" 2>&1
assert_pass "model name propagated to ConfigMap" grep -q 'claude-4' "$TMPDIR_TEST/model.yaml"

# --- Auth Secret tests ---

# No auth Secret when auth.username is empty (default)
assert_fail "no auth Secret when auth.username empty" grep -q 'neo-auth' "$TMPDIR_TEST/full.yaml"

# Auth Secret present when auth.username is set
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set auth.username=admin \
  --set auth.password=s3cret > "$TMPDIR_TEST/auth.yaml" 2>&1
assert_pass "auth Secret rendered when auth.username set" grep -q 'test-release-neo-auth' "$TMPDIR_TEST/auth.yaml"
assert_pass "auth Secret contains username key" grep -q 'username:' "$TMPDIR_TEST/auth.yaml"
assert_pass "auth Secret contains password key" grep -q 'password:' "$TMPDIR_TEST/auth.yaml"
assert_pass "auth Secret contains ttyd-credential key" grep -q 'ttyd-credential:' "$TMPDIR_TEST/auth.yaml"
assert_pass "auth Secret ttyd-credential has user:pass format" grep -q 'admin:s3cret' "$TMPDIR_TEST/auth.yaml"

# NEO_AUTH_USER env wired into neo-ui container
assert_pass "NEO_AUTH_USER env in deployment" grep -q 'NEO_AUTH_USER' "$TMPDIR_TEST/auth.yaml"
assert_pass "NEO_AUTH_PASS env in deployment" grep -q 'NEO_AUTH_PASS' "$TMPDIR_TEST/auth.yaml"

# TTYD_CREDENTIAL from auth Secret when auth is set
assert_pass "TTYD_CREDENTIAL from auth Secret" grep -q 'neo-auth' "$TMPDIR_TEST/auth.yaml"

# --- ServiceMonitor tests ---

# No ServiceMonitor when metrics.enabled is false (default)
assert_fail "no ServiceMonitor when metrics.enabled false" grep -q 'kind: ServiceMonitor' "$TMPDIR_TEST/full.yaml"

# ServiceMonitor present when metrics.enabled is true
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set metrics.enabled=true > "$TMPDIR_TEST/metrics.yaml" 2>&1
assert_pass "ServiceMonitor rendered when metrics.enabled true" grep -q 'kind: ServiceMonitor' "$TMPDIR_TEST/metrics.yaml"
assert_pass "ServiceMonitor targets /api/metrics path" grep -q '/api/metrics' "$TMPDIR_TEST/metrics.yaml"
assert_pass "ServiceMonitor targets neo-ui port" grep -q 'neo-ui' "$TMPDIR_TEST/metrics.yaml"

# Custom metrics interval
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set metrics.enabled=true \
  --set metrics.interval=15s > "$TMPDIR_TEST/metrics-interval.yaml" 2>&1
assert_pass "custom metrics interval propagated" grep -q '15s' "$TMPDIR_TEST/metrics-interval.yaml"

# --- Task env var tests ---

# CLAUDE_CODE_ENABLE_TASKS in ConfigMap when config.enableTasks is true (default)
assert_pass "ConfigMap includes CLAUDE_CODE_ENABLE_TASKS when enableTasks true" grep -q 'CLAUDE_CODE_ENABLE_TASKS: "1"' "$TMPDIR_TEST/full.yaml"

# CLAUDE_CODE_ENABLE_TASKS env injected into claude-code container via envFrom
assert_pass "claude-code container gets ConfigMap via envFrom" grep -q 'configMapRef' "$TMPDIR_TEST/full.yaml"

# Optional CLAUDE_CODE_TASK_LIST_ID injected when config.taskListId is non-empty
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set config.taskListId=my-tasks > "$TMPDIR_TEST/tasklist.yaml" 2>&1
assert_pass "CLAUDE_CODE_TASK_LIST_ID in ConfigMap when taskListId set" grep -q 'CLAUDE_CODE_TASK_LIST_ID: "my-tasks"' "$TMPDIR_TEST/tasklist.yaml"

# CLAUDE_CODE_TASK_LIST_ID absent when taskListId is empty
assert_fail "no CLAUDE_CODE_TASK_LIST_ID when taskListId empty" grep -q 'CLAUDE_CODE_TASK_LIST_ID' "$TMPDIR_TEST/full.yaml"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
