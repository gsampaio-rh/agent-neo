#!/usr/bin/env bash
# Runs Kata isolation checks and writes isolation-state.json.
#
# Called once at container startup by entrypoint.sh. The runtime doesn't
# change while the pod is running, so there's no need to poll.
#
# Each check tries an operation that succeeds on runc but fails on Kata.
# If the operation fails (exit != 0), isolation is working → pass.
# Each check captures a "detail" string — evidence of what was found.
set -euo pipefail

STATE_DIR="${CLAUDE_LOG_DIR:-/tmp/claude-logs}"
STATE_FILE="$STATE_DIR/isolation-state.json"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr '\n' ' ' | head -c 200
}

ns_pass=false; ns_detail=""
if unshare --mount --pid -- true 2>/dev/null; then
  ns_detail="unshare succeeded — PID/mount namespaces can be created, container escape possible"
else
  ns_pass=true
  ns_detail="unshare blocked by guest kernel boundary"
fi

hp_pass=false; hp_detail=""
if ls /proc/1/root/ >/dev/null 2>&1; then
  hp_entries=$(ls /proc/1/root/ 2>/dev/null | head -8 | tr '\n' ', ' | sed 's/,$//')
  hp_detail="host root visible: ${hp_entries}"
else
  hp_pass=true
  hp_detail="host filesystem isolated by Kata guest kernel"
fi

km_pass=false; km_detail=""
if modprobe dummy 2>/dev/null; then
  km_detail="modprobe succeeded — kernel modules loadable from container"
  rmmod dummy 2>/dev/null || true
else
  km_pass=true
  km_detail="modprobe blocked by hypervisor boundary"
fi

runtime="runc"
[[ "$ns_pass" == "true" && "$hp_pass" == "true" && "$km_pass" == "true" ]] && runtime="kata"

cat > "${STATE_FILE}.tmp" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "runtime": "$runtime",
  "checks": [
    { "name": "namespace_escape", "label": "Namespace escape", "pass": $ns_pass, "detail": "$(json_escape "$ns_detail")" },
    { "name": "host_pid", "label": "Host filesystem", "pass": $hp_pass, "detail": "$(json_escape "$hp_detail")" },
    { "name": "kernel_module", "label": "Kernel modules", "pass": $km_pass, "detail": "$(json_escape "$km_detail")" }
  ]
}
EOF
mv "${STATE_FILE}.tmp" "$STATE_FILE"
echo "[isolation] runtime=$runtime (ns=$ns_pass hp=$hp_pass km=$km_pass)"
