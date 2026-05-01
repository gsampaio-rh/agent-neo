#!/usr/bin/env bash
# Neo — configuration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHART_DIR="$PROJECT_ROOT/chart"
BUILD_DIR="$PROJECT_ROOT/build"
PROMPTS_DIR="$PROJECT_ROOT/prompts"

if [[ -f "$PROJECT_ROOT/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi

export NAMESPACE="${NAMESPACE:-agent-namespace}"
export RELEASE_NAME="${RELEASE_NAME:-neo}"
export MODEL_NAME="${MODEL_NAME:-glm47-flash}"
export UI_SRC_DIR="${UI_SRC_DIR:-$PROJECT_ROOT/ui}"
export READY_TIMEOUT="${READY_TIMEOUT:-120s}"

export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-}"
export TTYD_CREDENTIAL="${TTYD_CREDENTIAL:-}"
export NEO_AUTH_USER="${NEO_AUTH_USER:-}"
export NEO_AUTH_PASS="${NEO_AUTH_PASS:-}"
export CHALLENGE_PROMPT_FILE="${PROMPTS_DIR}/escape.txt"

export AGENT_BC_NAME="${AGENT_BC_NAME:-neo-agent}"
export UI_BC_NAME="${UI_BC_NAME:-neo-ui}"

validate_config() {
  local errors=0
  if [[ -z "$ANTHROPIC_BASE_URL" ]]; then
    echo "ERROR: ANTHROPIC_BASE_URL is required."
    echo "  Set it in .env or export it before running this script."
    errors=$((errors + 1))
  fi
  return "$errors"
}
