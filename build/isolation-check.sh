#!/usr/bin/env bash
# Detects whether the pod runs inside a Kata microVM or standard runc.
#
# Called once at container startup by entrypoint.sh. The runtime doesn't
# change while the pod is running, so there's no need to poll.
#
# Uses empirical signals that differ between Kata guest VMs and runc
# containers on OpenShift. Each signal has a weight; a combined score
# of 3+ means Kata. The /proc/cmdline check alone (weight 3) is
# sufficient, but secondary signals provide defense-in-depth.
set -euo pipefail

STATE_DIR="${CLAUDE_LOG_DIR:-/tmp/claude-logs}"
STATE_FILE="$STATE_DIR/isolation-state.json"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' | tr '\n' ' ' | head -c 200
}

score=0

# --- Signal 1: Kata agent params in /proc/cmdline (weight 3) ---
# The Kata runtime injects "agent.log=..." and other "agent.*" params
# into the guest kernel cmdline. These never appear in host kernels.
cmdline_pass=false; cmdline_detail=""
if [[ -r /proc/cmdline ]] && grep -q 'agent\.log=' /proc/cmdline 2>/dev/null; then
  cmdline_pass=true
  cmdline_detail="Kata agent params found in /proc/cmdline"
  score=$((score + 3))
else
  cmdline_detail="no Kata agent params in /proc/cmdline"
fi

# --- Signal 2: No block devices in /sys/block (weight 2) ---
# Kata uses virtio-fs for rootfs — no block devices are exposed to
# the guest. runc containers see the host's block devices.
blockdev_pass=false; blockdev_detail=""
block_entries=$(ls /sys/block/ 2>/dev/null || true)
if [[ -z "$block_entries" ]]; then
  blockdev_pass=true
  blockdev_detail="/sys/block/ is empty (virtio-fs rootfs)"
  score=$((score + 2))
else
  blockdev_detail="block devices visible: $(echo "$block_entries" | head -4 | tr '\n' ', ' | sed 's/,$//')"
fi

# --- Signal 3: ACPI tables present (weight 1) ---
# Kata's QEMU exposes emulated ACPI tables; runc on AWS Nitro does not
# expose them to containers.
acpi_pass=false; acpi_detail=""
if [[ -d /sys/firmware/acpi/tables ]]; then
  acpi_tables=$(ls /sys/firmware/acpi/tables/ 2>/dev/null | head -5 | tr '\n' ', ' | sed 's/,$//')
  acpi_pass=true
  acpi_detail="ACPI tables present: ${acpi_tables}"
  score=$((score + 1))
else
  acpi_detail="no ACPI tables (host kernel does not expose them to containers)"
fi

# --- Signal 4: No BOOT_IMAGE in /proc/cmdline (weight 1) ---
# Host RHCOS/CoreOS always includes BOOT_IMAGE= in its kernel cmdline.
# Kata guest kernels do not have this parameter.
bootimg_pass=false; bootimg_detail=""
if [[ -r /proc/cmdline ]] && ! grep -q 'BOOT_IMAGE=' /proc/cmdline 2>/dev/null; then
  bootimg_pass=true
  bootimg_detail="no BOOT_IMAGE= in /proc/cmdline (not a host kernel)"
  score=$((score + 1))
else
  bootimg_detail="BOOT_IMAGE= present in /proc/cmdline (host kernel)"
fi

# --- Runtime decision: score >= 3 → kata ---
runtime="runc"
[[ "$score" -ge 3 ]] && runtime="kata"

cat > "${STATE_FILE}.tmp" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "runtime": "$runtime",
  "score": $score,
  "checks": [
    { "name": "kata_cmdline", "label": "Kata agent cmdline", "pass": $cmdline_pass, "detail": "$(json_escape "$cmdline_detail")" },
    { "name": "block_devices", "label": "Block device isolation", "pass": $blockdev_pass, "detail": "$(json_escape "$blockdev_detail")" },
    { "name": "acpi_tables", "label": "ACPI table exposure", "pass": $acpi_pass, "detail": "$(json_escape "$acpi_detail")" },
    { "name": "boot_image", "label": "Host boot signature", "pass": $bootimg_pass, "detail": "$(json_escape "$bootimg_detail")" }
  ]
}
EOF
mv "${STATE_FILE}.tmp" "$STATE_FILE"
echo "[isolation] runtime=$runtime score=$score (cmdline=$cmdline_pass block=$blockdev_pass acpi=$acpi_pass boot=$bootimg_pass)"
