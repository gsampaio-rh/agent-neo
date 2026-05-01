#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${CLAUDE_LOG_DIR:-/tmp/claude-logs}"
LOG_FILE="$LOG_DIR/claude.jsonl"
mkdir -p "$LOG_DIR"
touch "$LOG_FILE"

echo "============================================================"
echo " Neo — Agent Container"
echo "============================================================"
echo ""
echo "  Version:    $(claude --version 2>/dev/null || echo 'not found')"
echo "  Base URL:   ${ANTHROPIC_BASE_URL:-not set}"
echo "  Model:      ${ANTHROPIC_DEFAULT_SONNET_MODEL:-not set}"
echo "  Max Output: ${CLAUDE_CODE_MAX_OUTPUT_TOKENS:-default}"
echo "  Python:     $(python3 --version 2>/dev/null || echo 'not found')"
echo "  curl:       $(command -v curl &>/dev/null && echo 'AVAILABLE (unexpected!)' || echo 'removed')"
echo "  kubectl:    $(command -v kubectl &>/dev/null && echo 'AVAILABLE (unexpected!)' || echo 'removed')"
echo "  Web Term:   $(command -v ttyd &>/dev/null && echo 'enabled → :7681' || echo 'disabled')"
echo "  Log Dir:    $LOG_DIR"
echo "  Started:    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "  Usage:"
echo "    oc exec -it <pod> -- claude -p 'prompt'      # headless"
echo "    oc exec <pod> -- claude-logged 'prompt'       # headless + logs"
echo ""
echo "  Logs stream below (from claude-logged invocations):"
echo "------------------------------------------------------------"

CLAUDE_HOME="${HOME:-/opt/app-root/src}/.claude"
if [[ -f "$CLAUDE_HOME/CLAUDE.md" && ! -f "$CLAUDE_HOME/CLAUDE.md.bak" ]]; then
  cp "$CLAUDE_HOME/CLAUDE.md" "$CLAUDE_HOME/CLAUDE.md.bak"
  echo "[entrypoint] Backed up CLAUDE.md"
fi

SYSLOG="$LOG_DIR/system.log"
touch "$SYSLOG"

if command -v ttyd &>/dev/null; then
  TTYD_ARGS=(-p 7681 --writable)
  if [[ -n "${TTYD_CREDENTIAL:-}" ]]; then
    TTYD_ARGS+=(--credential "$TTYD_CREDENTIAL")
  fi
  ttyd "${TTYD_ARGS[@]}" bash &
fi

/usr/local/lib/neo/net-monitor.sh 2>&1 | tee -a "$SYSLOG" &

# Prompt watcher with automatic respawn
while true; do
  /usr/local/lib/neo/prompt-watcher.sh 2>&1 | tee -a "$SYSLOG" || echo "[entrypoint] prompt-watcher exited ($?), restarting in 2s ..."
  sleep 2
done &

exec sleep infinity
