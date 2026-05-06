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

# --- Telemetry env var tests ---

# Telemetry is enabled by default — verify vars present in full.yaml
assert_pass "CLAUDE_CODE_ENABLE_TELEMETRY in default render" grep -q 'CLAUDE_CODE_ENABLE_TELEMETRY: "1"' "$TMPDIR_TEST/full.yaml"
assert_pass "OTEL_METRICS_EXPORTER is prometheus by default" grep -q 'OTEL_METRICS_EXPORTER: "prometheus"' "$TMPDIR_TEST/full.yaml"
assert_pass "OTEL_EXPORTER_PROMETHEUS_PORT in default render" grep -q 'OTEL_EXPORTER_PROMETHEUS_PORT: "9464"' "$TMPDIR_TEST/full.yaml"
assert_pass "OTEL_METRIC_EXPORT_INTERVAL in default render" grep -q 'OTEL_METRIC_EXPORT_INTERVAL' "$TMPDIR_TEST/full.yaml"

# Telemetry absent when explicitly disabled
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set config.telemetry.enabled=false > "$TMPDIR_TEST/telemetry-off.yaml" 2>&1
assert_fail "no CLAUDE_CODE_ENABLE_TELEMETRY when telemetry disabled" grep -q 'CLAUDE_CODE_ENABLE_TELEMETRY' "$TMPDIR_TEST/telemetry-off.yaml"

# No traces beta flag when tracesExporter is "none" (default)
assert_fail "no CLAUDE_CODE_ENHANCED_TELEMETRY_BETA when traces none" grep -q 'CLAUDE_CODE_ENHANCED_TELEMETRY_BETA' "$TMPDIR_TEST/full.yaml"

# Traces beta flag present when tracesExporter is set to otlp
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set config.telemetry.tracesExporter=otlp > "$TMPDIR_TEST/telemetry-traces.yaml" 2>&1
assert_pass "CLAUDE_CODE_ENHANCED_TELEMETRY_BETA when traces otlp" grep -q 'CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1"' "$TMPDIR_TEST/telemetry-traces.yaml"
assert_pass "OTEL_TRACES_EXPORTER when traces otlp" grep -q 'OTEL_TRACES_EXPORTER: "otlp"' "$TMPDIR_TEST/telemetry-traces.yaml"

# OTLP endpoint rendered when set
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set config.telemetry.otlp.endpoint=http://collector:4318 > "$TMPDIR_TEST/telemetry-otlp.yaml" 2>&1
assert_pass "OTEL_EXPORTER_OTLP_ENDPOINT when endpoint set" grep -q 'OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318"' "$TMPDIR_TEST/telemetry-otlp.yaml"
assert_pass "OTEL_EXPORTER_OTLP_PROTOCOL when endpoint set" grep -q 'OTEL_EXPORTER_OTLP_PROTOCOL' "$TMPDIR_TEST/telemetry-otlp.yaml"

# No OTLP endpoint when not configured
assert_fail "no OTEL_EXPORTER_OTLP_ENDPOINT when endpoint empty" grep -q 'OTEL_EXPORTER_OTLP_ENDPOINT' "$TMPDIR_TEST/full.yaml"

# --- Prometheus metrics port + Service tests ---

# otel-metrics port exposed on claude-code container (prometheus is default)
assert_pass "otel-metrics port on claude-code container" grep -q 'otel-metrics' "$TMPDIR_TEST/full.yaml"
assert_pass "containerPort 9464 on claude-code" grep -q '9464' "$TMPDIR_TEST/full.yaml"

# agent-metrics Service rendered when prometheus exporter enabled
assert_pass "agent-metrics Service rendered" grep -q 'agent-metrics' "$TMPDIR_TEST/full.yaml"

# No otel-metrics port when telemetry disabled
assert_fail "no otel-metrics port when telemetry off" grep -q 'otel-metrics' "$TMPDIR_TEST/telemetry-off.yaml"

# --- Build source type tests ---

# Default is Git source (from values.yaml)
assert_pass "agent BuildConfig uses Git source type by default" grep -q 'type: Git' "$TMPDIR_TEST/full.yaml"
assert_pass "agent BuildConfig has git uri" grep -q 'uri: https://github.com/gsampaio-rh/agent-neo.git' "$TMPDIR_TEST/full.yaml"
assert_pass "agent BuildConfig has git ref" grep -q 'ref: main' "$TMPDIR_TEST/full.yaml"
assert_pass "agent BuildConfig has contextDir build" grep -q 'contextDir: build' "$TMPDIR_TEST/full.yaml"
assert_pass "UI BuildConfig has contextDir ui" grep -q 'contextDir: ui' "$TMPDIR_TEST/full.yaml"

# Binary source when build.source.type is Binary
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set build.source.type=Binary > "$TMPDIR_TEST/binary-build.yaml" 2>&1
assert_pass "BuildConfig uses Binary source when type=Binary" grep -q 'type: Binary' "$TMPDIR_TEST/binary-build.yaml"
assert_fail "no git uri when Binary source" grep -q 'uri: https://github.com' "$TMPDIR_TEST/binary-build.yaml"
assert_fail "no contextDir when Binary source" grep -q 'contextDir:' "$TMPDIR_TEST/binary-build.yaml"

# Custom git ref
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set build.source.git.ref=develop > "$TMPDIR_TEST/custom-ref.yaml" 2>&1
assert_pass "custom git ref propagated" grep -q 'ref: develop' "$TMPDIR_TEST/custom-ref.yaml"

# --- Agent ServiceMonitor tests ---

# Agent ServiceMonitor rendered when both telemetry (prometheus) and metrics.enabled are true
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set metrics.enabled=true > "$TMPDIR_TEST/agent-sm.yaml" 2>&1
assert_pass "agent ServiceMonitor rendered" grep -q 'neo-agent' "$TMPDIR_TEST/agent-sm.yaml"
assert_pass "agent ServiceMonitor targets otel-metrics port" grep -q 'otel-metrics' "$TMPDIR_TEST/agent-sm.yaml"

# No agent ServiceMonitor when metrics.enabled is false (default)
# Use specific name pattern to avoid matching agent-metrics Service
assert_fail "no agent ServiceMonitor when metrics.enabled false" grep -q 'name: test-release-neo-agent$' "$TMPDIR_TEST/full.yaml"

# --- Kata runtime tests ---

# No runtimeClassName when runtime.kata.enabled is false (default)
assert_fail "no runtimeClassName when kata disabled (default)" grep -q 'runtimeClassName' "$TMPDIR_TEST/full.yaml"

# No nodeSelector from runtime block in default render
assert_fail "no nodeSelector from runtime block by default" grep -q 'nodeSelector' "$TMPDIR_TEST/full.yaml"

# runtimeClassName present when runtime.kata.enabled=true
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set runtime.kata.enabled=true > "$TMPDIR_TEST/kata.yaml" 2>&1
assert_pass "runtimeClassName: kata when kata enabled" grep -q 'runtimeClassName: kata' "$TMPDIR_TEST/kata.yaml"

# nodeSelector present when runtime.nodeSelector is set
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set runtime.kata.enabled=true \
  --set 'runtime.nodeSelector.node\.kubernetes\.io/instance-type=m5.metal' > "$TMPDIR_TEST/kata-ns.yaml" 2>&1
assert_pass "nodeSelector rendered when runtime.nodeSelector set" grep -q 'nodeSelector' "$TMPDIR_TEST/kata-ns.yaml"
assert_pass "nodeSelector contains instance-type key" grep -q 'instance-type' "$TMPDIR_TEST/kata-ns.yaml"

# No runtimeClassName when kata disabled but nodeSelector set
helm template test-release "$CHART_DIR" \
  --set config.anthropicBaseUrl=http://test.example.com \
  --set runtime.kata.enabled=false \
  --set 'runtime.nodeSelector.node\.kubernetes\.io/instance-type=m5.metal' > "$TMPDIR_TEST/kata-off-ns.yaml" 2>&1
assert_fail "no runtimeClassName when kata disabled with nodeSelector" grep -q 'runtimeClassName' "$TMPDIR_TEST/kata-off-ns.yaml"
assert_pass "nodeSelector still rendered when kata disabled but nodeSelector set" grep -q 'nodeSelector' "$TMPDIR_TEST/kata-off-ns.yaml"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
