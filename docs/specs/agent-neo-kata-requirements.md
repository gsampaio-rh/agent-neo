# Requirements: Kata Container Support for agent-neo Chart

**Status:** Draft
**Date:** 2026-05-06
**Consumer:** [the-matrix-infra](https://github.com/gsampaio-rh/the-matrix-infra) — passes values via `values/neo.yaml.gotmpl`
**Related:** [Chapter 1 Spec](chapter-1-harden-the-box.md) (lines 341–448)

---

## Summary

The agent-neo Helm chart must support running the Neo pod inside a Kata microVM by setting `runtimeClassName: kata` on the pod spec. This is activated via a Helm value (`runtime.kata.enabled`) and must be fully reversible.

Workshop flow: Neo starts on runc (default). During Chapter 1, participants run `helm upgrade --set runtime.kata.enabled=true` to move Neo into a Kata microVM. Isolation status is visible in the Box tab UI — no `oc exec` required.

## Helm Values Contract

Add the following block to `chart/values.yaml`:

```yaml
runtime:
  kata:
    enabled: false
  nodeSelector: {}
```

The infra repo will pass these values via `values/neo.yaml.gotmpl`:

```yaml
runtime:
  kata:
    enabled: true    # or false (default)
  nodeSelector:
    node.kubernetes.io/instance-type: m5.metal
```

When `runtime.kata.enabled` is `false` (or omitted), the chart must produce a pod spec with **no** `runtimeClassName` and **no** `nodeSelector` from the `runtime` block.

## Deployment Template Changes

### runtimeClassName

In `chart/templates/deployment.yaml`, add conditional `runtimeClassName` inside `spec.template.spec` (before `serviceAccountName` or after it — order doesn't matter to K8s):

```yaml
    spec:
      serviceAccountName: {{ include "neo.fullname" . }}
      {{- if .Values.runtime.kata.enabled }}
      runtimeClassName: kata
      {{- end }}
      {{- with .Values.runtime.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

Current deployment.yaml (line 21–22) has:

```yaml
    spec:
      serviceAccountName: {{ include "neo.fullname" . }}
```

The change inserts `runtimeClassName` and `nodeSelector` between `serviceAccountName` and `volumes`.

### Isolation Status in Box Tab

Instead of a separate script that participants run via `oc exec`, isolation checks run automatically on container startup and results are displayed in the Box tab UI.

**Agent side:** On startup, the agent container runs three isolation checks and writes results to `isolation-state.json` in the shared volume (`claude-logs`):

```json
{
  "timestamp": "2026-05-06T14:30:00Z",
  "runtime": "kata",
  "checks": [
    { "name": "namespace_escape", "label": "Kernel namespace escape (unshare)", "pass": true },
    { "name": "host_pid", "label": "Host PID namespace (/proc/1/root)", "pass": true },
    { "name": "kernel_module", "label": "Kernel module load (modprobe)", "pass": true }
  ]
}
```

The checks are:

1. **Namespace escape:** `unshare --mount --pid -- true` — succeeds on runc, blocked on Kata
2. **Host PID namespace:** `ls /proc/1/root/` — visible on runc, isolated on Kata
3. **Kernel module load:** `modprobe dummy` — loadable on runc, blocked on Kata

When all checks pass → `"runtime": "kata"`. When any check fails → `"runtime": "runc"`.

**Relay side:** The relay reads `isolation-state.json` from the shared volume and exposes it via SSE/API (same pattern as `net-state.json`).

**UI side:** The Box tab displays isolation status — PASS/FAIL per check with visual indicators (e.g., green/red badges). Participants see the difference immediately after `helm upgrade`.

### Resource Overhead

Kata adds approximately **250m CPU** and **2Gi memory** per pod for the guest OS kernel and QEMU process. Document this in `values.yaml` comments near the `resources` block:

```yaml
resources:
  agent:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: "1"
      memory: 2Gi
  # When runtime.kata.enabled=true, Kata adds ~250m CPU + 2Gi memory overhead
  # for the guest OS. If the pod hits resource limits, increase limits accordingly.
  # Example Kata-adjusted limits:
  #   agent.limits.cpu: "2"
  #   agent.limits.memory: 4Gi
```

No automatic adjustment is needed — the current limits work for workshop scope. The comment serves as documentation for constrained environments.

## Rollback Contract

Setting `runtime.kata.enabled=false` (or omitting it) must:

1. Remove `runtimeClassName: kata` from the pod spec
2. Remove `nodeSelector` from the `runtime` block (other nodeSelectors unaffected)
3. Leave all other pod spec fields unchanged

The pod restarts on runc with the standard container runtime. The isolation checks re-run on startup and `isolation-state.json` updates automatically — the Box tab reflects the new runtime. No manual cleanup required.

## Verification Criteria

### Helm Template — with `runtime.kata.enabled=true`

```bash
helm template neo chart/ --set runtime.kata.enabled=true \
  --set runtime.nodeSelector."node\.kubernetes\.io/instance-type"=m5.metal
```

Must produce:

- [ ] Deployment has `runtimeClassName: kata` in pod spec
- [ ] Deployment has `nodeSelector` with `node.kubernetes.io/instance-type: m5.metal`
- [ ] All existing fields (probes, env, securityContext, etc.) are unchanged

### Helm Template — with defaults (runtime.kata.enabled=false)

```bash
helm template neo chart/
```

Must produce:

- [ ] No `runtimeClassName` field in pod spec
- [ ] No `nodeSelector` from `runtime` block
- [ ] Output is identical to current chart output (no regressions)

### Isolation Status — runtime behavior

- [ ] On Kata: `isolation-state.json` shows `"runtime": "kata"`, all checks pass
- [ ] On runc: `isolation-state.json` shows `"runtime": "runc"`, all checks fail
- [ ] Box tab UI renders PASS/FAIL per check
- [ ] After rollback (kata → runc), pod restarts and `isolation-state.json` updates automatically

## Participant Workflow

```bash
# 1. Check Box tab — see runc isolation status (all checks FAIL)

# 2. Upgrade Neo to Kata
helm upgrade neo ./chart --set runtime.kata.enabled=true -n $TEAM_NS

# 3. Wait for pod restart, check Box tab — see kata isolation status (all checks PASS)

# 4. Rollback to runc
helm upgrade neo ./chart --set runtime.kata.enabled=false -n $TEAM_NS

# 5. Check Box tab — back to runc (all checks FAIL)
```

## Reference Implementation

The `~/redhat/iac/claude-code-agent/` repo implements a similar pattern using raw manifests instead of Helm:

- `manifests/deployment.yaml` line 28: `runtimeClassName: __RUNTIME_CLASS__` placeholder
- `scripts/02-deploy-agent.sh` lines 35–40: conditional sed/grep to include or strip the field
- `scripts/config.sh` line 26: `RUNTIME_CLASS="${RUNTIME_CLASS-kata}"` default

The Helm approach is cleaner — use `{{- if .Values.runtime.kata.enabled }}` conditionals instead of sed substitution.

## Cluster Prerequisites (not in scope for agent-neo)

These are handled by `the-matrix-infra` and listed here for context only:

- Bare metal nodes with `/dev/kvm` (e.g., AWS m5.metal)
- Sandboxed Containers Operator installed (`openshift-sandboxed-containers-operator` namespace)
- `KataConfig` CR applied (triggers MachineConfigPool rollout)
- `RuntimeClass` named `kata` exists (created automatically by the operator)
