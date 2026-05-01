#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.sh
source "$SCRIPT_DIR/config.sh"

echo "============================================================"
echo " Neo | Deploy via Helm"
echo "============================================================"
echo ""
echo "  Release:   $RELEASE_NAME"
echo "  Namespace: $NAMESPACE"
echo "  Model:     $MODEL_NAME"
echo ""

validate_config

echo "── Installing/upgrading Helm release ──"
HELM_ARGS=(
  upgrade --install "$RELEASE_NAME" "$CHART_DIR"
  --namespace "$NAMESPACE"
  --set "config.anthropicBaseUrl=$ANTHROPIC_BASE_URL"
  --set "config.modelName=$MODEL_NAME"
)
if [[ -n "$NEO_AUTH_USER" ]]; then
  HELM_ARGS+=(--set "auth.username=$NEO_AUTH_USER" --set "auth.password=$NEO_AUTH_PASS")
elif [[ -n "$TTYD_CREDENTIAL" ]]; then
  HELM_ARGS+=(--set "ttyd.credential=$TTYD_CREDENTIAL")
fi
helm "${HELM_ARGS[@]}"
echo ""

echo "── Building Agent image ($AGENT_BC_NAME) ──"
echo "  Uploading source from $BUILD_DIR ..."
oc start-build "$AGENT_BC_NAME" \
  --from-dir="$BUILD_DIR" \
  -n "$NAMESPACE" --wait --follow
echo ""

echo "── Building UI image ($UI_BC_NAME) ──"
echo "  Uploading source from $UI_SRC_DIR ..."
oc start-build "$UI_BC_NAME" \
  --from-dir="$UI_SRC_DIR" \
  -n "$NAMESPACE" --wait --follow
echo ""

echo "── Restarting deployment ──"
oc rollout restart "deployment/${RELEASE_NAME}" -n "$NAMESPACE"
echo ""

echo "── Waiting for rollout ──"
oc rollout status "deployment/${RELEASE_NAME}" -n "$NAMESPACE" --timeout="${READY_TIMEOUT}"
echo ""

TERMINAL_HOST=$(oc get route "${RELEASE_NAME}-web-terminal" -n "$NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
UI_HOST=$(oc get route "${RELEASE_NAME}-ui" -n "$NAMESPACE" -o jsonpath='{.spec.host}' 2>/dev/null || echo "")

echo "Pod deployed."
echo ""
if [[ -n "$TERMINAL_HOST" ]]; then
  echo "  Web terminal (HTTPS):  https://${TERMINAL_HOST}"
else
  echo "  Web terminal route not ready yet; check: oc get route ${RELEASE_NAME}-web-terminal -n $NAMESPACE"
fi
if [[ -n "$UI_HOST" ]]; then
  echo "  Neo dashboard:         https://${UI_HOST}"
else
  echo "  UI route not ready yet; check: oc get route ${RELEASE_NAME}-ui -n $NAMESPACE"
fi
echo ""
