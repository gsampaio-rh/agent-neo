# Requirements: Kata Container Support for agent-neo Chart

**Status:** Draft
**Date:** 2026-05-06
**Consumer:** [the-matrix-infra](https://github.com/gsampaio-rh/the-matrix-infra) — passes values via `values/neo.yaml.gotmpl`
**Related:** [Chapter 1 Spec](chapter-1-harden-the-box.md) (lines 341–448)

---

## Summary

The agent-neo Helm chart must support running the Neo pod inside a Kata microVM by setting `runtimeClassName: kata` on the pod spec. This is activated via a Helm value (`runtime.kata.enabled`) and must be fully reversible.

Workshop flow: Neo starts on runc (default). During Chapter 1, participants run `helm upgrade --set runtime.kata.enabled=true` to move Neo into a Kata microVM, then run an escape-test script to verify isolation.

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

### Escape-Test Script

The escape-test script must be available at `/opt/escape-test.sh` inside the `claude-code` container when Kata is enabled. Two delivery options — choose whichever fits better in the agent-neo repo:

**Option A: ConfigMap (recommended)**

Create `chart/templates/configmap-escape-test.yaml`:

```yaml
{{- if .Values.runtime.kata.enabled }}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "neo.fullname" . }}-escape-test
  labels:
    {{- include "neo.labels" . | nindent 4 }}
data:
  escape-test.sh: |
    #!/bin/bash
    echo "=== Kata Isolation Test ==="
    echo ""

    echo -n "[TEST 1] Kernel namespace escape (unshare --mount --pid): "
    if unshare --mount --pid -- true 2>/dev/null; then
      echo "FAIL — escape possible (runc)"
    else
      echo "PASS — blocked by guest kernel boundary"
    fi

    echo -n "[TEST 2] Host PID namespace (/proc/1/root): "
    if ls /proc/1/root/ >/dev/null 2>&1; then
      echo "FAIL — host filesystem visible (runc)"
    else
      echo "PASS — isolated filesystem (Kata guest kernel)"
    fi

    echo -n "[TEST 3] Kernel module load (modprobe): "
    if modprobe dummy 2>/dev/null; then
      echo "FAIL — kernel modules loadable (runc)"
    else
      echo "PASS — blocked by hypervisor boundary"
    fi

    echo ""
    echo "=== End ==="
{{- end }}
```

Add conditional volume and volumeMount in `deployment.yaml`:

Volume (add to `spec.template.spec.volumes`):

```yaml
      {{- if .Values.runtime.kata.enabled }}
        - name: escape-test
          configMap:
            name: {{ include "neo.fullname" . }}-escape-test
            defaultMode: 0755
      {{- end }}
```

VolumeMount (add to the `claude-code` container's `volumeMounts`):

```yaml
          {{- if .Values.runtime.kata.enabled }}
            - name: escape-test
              mountPath: /opt/escape-test.sh
              subPath: escape-test.sh
              readOnly: true
          {{- end }}
```

**Option B: Baked into image**

Add the script to `build/escape-test.sh` and copy it in the Dockerfile:

```dockerfile
COPY escape-test.sh /opt/escape-test.sh
RUN chmod +x /opt/escape-test.sh
```

This is simpler (no ConfigMap, no volume) but requires an image rebuild to change the script.

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
3. Remove the escape-test ConfigMap (if using Option A)
4. Remove the escape-test volume and volumeMount
5. Leave all other pod spec fields unchanged

The pod restarts on runc with the standard container runtime. No manual cleanup required.

## Verification Criteria

### With `runtime.kata.enabled=true`

```bash
helm template neo chart/ --set runtime.kata.enabled=true \
  --set runtime.nodeSelector."node\.kubernetes\.io/instance-type"=m5.metal
```

Must produce:

- [ ] Deployment has `runtimeClassName: kata` in pod spec
- [ ] Deployment has `nodeSelector` with `node.kubernetes.io/instance-type: m5.metal`
- [ ] ConfigMap `neo-escape-test` exists (if using Option A)
- [ ] Volume `escape-test` in pod spec references the ConfigMap
- [ ] VolumeMount at `/opt/escape-test.sh` on `claude-code` container
- [ ] All existing fields (probes, env, securityContext, etc.) are unchanged

### With defaults (runtime.kata.enabled=false)

```bash
helm template neo chart/
```

Must produce:

- [ ] No `runtimeClassName` field in pod spec
- [ ] No `nodeSelector` from `runtime` block
- [ ] No `neo-escape-test` ConfigMap
- [ ] No `escape-test` volume or volumeMount
- [ ] Output is identical to current chart output (no regressions)

## Expected Escape-Test Output

### In Kata (after `helm upgrade --set runtime.kata.enabled=true`)

```
=== Kata Isolation Test ===

[TEST 1] Kernel namespace escape (unshare --mount --pid): PASS — blocked by guest kernel boundary
[TEST 2] Host PID namespace (/proc/1/root): PASS — isolated filesystem (Kata guest kernel)
[TEST 3] Kernel module load (modprobe): PASS — blocked by hypervisor boundary

=== End ===
```

### In runc (before Kata, or after rollback)

```
=== Kata Isolation Test ===

[TEST 1] Kernel namespace escape (unshare --mount --pid): FAIL — escape possible (runc)
[TEST 2] Host PID namespace (/proc/1/root): FAIL — host filesystem visible (runc)
[TEST 3] Kernel module load (modprobe): FAIL — kernel modules loadable (runc)

=== End ===
```

## Participant Workflow

```bash
# 1. Upgrade Neo to Kata
helm upgrade neo ./chart --set runtime.kata.enabled=true -n $TEAM_NS

# 2. Verify runtimeClassName
oc describe pod -l app.kubernetes.io/name=neo -n $TEAM_NS | grep runtimeClassName

# 3. Run escape test
oc exec -it deploy/neo -c claude-code -n $TEAM_NS -- /opt/escape-test.sh

# 4. Rollback to runc
helm upgrade neo ./chart --set runtime.kata.enabled=false -n $TEAM_NS
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
