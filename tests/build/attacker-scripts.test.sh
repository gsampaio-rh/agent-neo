#!/usr/bin/env bash
# Smoke tests for in-cluster attacker scripts.
# Validates --help output, lib.sh sourcing, and motd.sh banner.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ATTACKER_SCRIPTS="$PROJECT_ROOT/build/attacker/scripts"
ATTACKER_DIR="$PROJECT_ROOT/build/attacker"
PASS=0
FAIL=0

assert_exit_zero() {
  local desc="$1"
  shift
  if "$@" &>/dev/null; then
    echo "  PASS: $desc"; PASS=$((PASS+1))
  else
    echo "  FAIL: $desc (exit code $?)"; FAIL=$((FAIL+1))
  fi
}

assert_output_contains() {
  local desc="$1" needle="$2"
  shift 2
  local out
  out=$("$@" 2>&1) || true
  if echo "$out" | grep -q "$needle"; then
    echo "  PASS: $desc"; PASS=$((PASS+1))
  else
    echo "  FAIL: $desc (expected '$needle')"; FAIL=$((FAIL+1))
  fi
}

echo "=== attacker scripts smoke tests ==="

echo ""
echo "--- lib.sh ---"
assert_exit_zero "lib.sh is sourceable" bash -c "source '$ATTACKER_SCRIPTS/lib.sh'"
assert_output_contains "lib.sh defines resolve_agent_ip" "resolve_agent_ip" bash -c "source '$ATTACKER_SCRIPTS/lib.sh' && type resolve_agent_ip"
assert_output_contains "lib.sh defines resolve_prompt" "resolve_prompt" bash -c "source '$ATTACKER_SCRIPTS/lib.sh' && type resolve_prompt"
assert_output_contains "lib.sh defines post_prompt" "post_prompt" bash -c "source '$ATTACKER_SCRIPTS/lib.sh' && type post_prompt"
assert_output_contains "lib.sh defines banner" "banner" bash -c "source '$ATTACKER_SCRIPTS/lib.sh' && type banner"

echo ""
echo "--- --help output ---"
for script in trigger.sh wait-shell.sh connect.sh exploit.sh full-attack.sh hold-shell.sh; do
  assert_exit_zero "$script --help exits 0" bash "$ATTACKER_SCRIPTS/$script" --help
  assert_output_contains "$script --help shows Usage" "Usage" bash "$ATTACKER_SCRIPTS/$script" --help
  assert_output_contains "$script --help shows Environment" "Environment\|environment\|Config\|commands" bash "$ATTACKER_SCRIPTS/$script" --help
done

echo ""
echo "--- motd.sh ---"
assert_exit_zero "motd.sh exits 0" bash "$ATTACKER_DIR/motd.sh"
assert_output_contains "motd.sh shows ATTACKER TERMINAL" "ATTACKER TERMINAL" bash "$ATTACKER_DIR/motd.sh"
assert_output_contains "motd.sh shows full-attack.sh" "full-attack.sh" bash "$ATTACKER_DIR/motd.sh"
assert_output_contains "motd.sh shows hold-shell.sh" "hold-shell.sh" bash "$ATTACKER_DIR/motd.sh"
assert_output_contains "motd.sh shows AGENT_NS" "AGENT_NS" bash "$ATTACKER_DIR/motd.sh"

echo ""
echo "--- entrypoint.sh ---"
assert_output_contains "entrypoint.sh shows help with --help or is readable" "ttyd\|Neo\|Attacker" bash -c "head -5 '$ATTACKER_DIR/entrypoint.sh'"

echo ""
echo "--- Dockerfile ---"
assert_output_contains "Dockerfile exists and has ttyd" "ttyd" cat "$ATTACKER_DIR/Dockerfile"
assert_output_contains "Dockerfile uses ubi9" "ubi9" cat "$ATTACKER_DIR/Dockerfile"
assert_output_contains "Dockerfile installs nmap-ncat" "nmap-ncat" cat "$ATTACKER_DIR/Dockerfile"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] || exit 1
