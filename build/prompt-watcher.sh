#!/usr/bin/env bash
# Prompt watcher — polls for prompt files and manages agent lifecycle.
#
# State machine:
#   idle → prompt.json detected → running (claude-logged) → done → idle
#
# Control files (all in LOG_DIR):
#   prompt.json     — queued prompt payload (written by relay)
#   prompt.running  — mutex while agent is executing
#   prompt.stop     — signal to kill running agent
#   prompt.reset    — signal to clear session + logs
#   agent.pid       — PID of running claude-logged process
#   .session-started — marker for --continue flag (managed by claude-logged)
set -euo pipefail

LOG_DIR="${CLAUDE_LOG_DIR:-/tmp/claude-logs}"
LOG_FILE="$LOG_DIR/claude.jsonl"
PID_FILE="$LOG_DIR/agent.pid"

echo "[prompt-watcher] Watching $LOG_DIR for prompt.json ..."

while true; do
  if [[ -f "$LOG_DIR/prompt.stop" ]]; then
    echo "[prompt-watcher] Stop requested."
    rm -f "$LOG_DIR/prompt.stop"
    if [[ -f "$PID_FILE" ]]; then
      AGENT_PID=$(cat "$PID_FILE")
      kill "$AGENT_PID" 2>/dev/null || true
      rm -f "$PID_FILE"
      echo "[prompt-watcher] Killed agent PID $AGENT_PID"
    fi
    rm -f "$LOG_DIR/prompt.running"
  fi

  if [[ -f "$LOG_DIR/prompt.reset-attack" ]]; then
    echo "[prompt-watcher] Attack reset requested — cleaning up."
    rm -f "$LOG_DIR/prompt.reset-attack"

    pkill -f 'python3.*socket.*bind' 2>/dev/null || true
    fuser -k 4444/tcp 2>/dev/null || true

    CLAUDE_HOME="${HOME:-/opt/app-root/src}/.claude"
    if [[ -f "$CLAUDE_HOME/CLAUDE.md.bak" ]]; then
      cp "$CLAUDE_HOME/CLAUDE.md.bak" "$CLAUDE_HOME/CLAUDE.md"
      echo "[prompt-watcher] Restored CLAUDE.md from backup."
    else
      rm -f "$CLAUDE_HOME/CLAUDE.md"
    fi

    rm -f "$CLAUDE_HOME/skills/k8s-ops.md"
    BASHRC="${HOME:-/opt/app-root/src}/.bashrc"
    if [[ -f "$BASHRC" ]]; then
      grep -v 'ANTHROPIC_BASE_URL' "$BASHRC" > "$BASHRC.tmp" 2>/dev/null && mv "$BASHRC.tmp" "$BASHRC" || true
    fi
    echo "[prompt-watcher] Attack reset complete."
  fi

  if [[ -f "$LOG_DIR/prompt.reset" ]]; then
    echo "[prompt-watcher] Reset requested — clearing session."
    rm -f "$LOG_DIR/prompt.reset" "$LOG_DIR/.session-started"
    : > "$LOG_FILE"
    touch "$LOG_DIR/reset.done"
    echo "[prompt-watcher] Session reset complete."
  fi

  if [[ -f "$LOG_DIR/prompt.json" ]]; then
    PROMPT="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['prompt'])" "$LOG_DIR/prompt.json" 2>/dev/null)" || {
      echo "[prompt-watcher] ERROR: Failed to parse prompt.json — skipping invalid payload."
      rm -f "$LOG_DIR/prompt.json"
      sleep 1
      continue
    }
    mv "$LOG_DIR/prompt.json" "$LOG_DIR/prompt.running"
    echo "[prompt-watcher] Running prompt (${#PROMPT} chars) ..."

    claude-logged "$PROMPT" &
    echo $! > "$PID_FILE"
    wait $! 2>/dev/null || echo "[prompt-watcher] claude-logged exited with $?"

    rm -f "$PID_FILE" "$LOG_DIR/prompt.running"
    echo "[prompt-watcher] Done. Waiting for next prompt."
  fi
  sleep 1
done
