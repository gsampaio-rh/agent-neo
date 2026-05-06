# Spec: Harden the Box Exercise

## Problem

Chapter 1 (Contain) needs a hands-on exercise that teaches Kubernetes pod hardening — NetworkPolicy, RBAC, and SecurityContext — without requiring participants to write YAML from scratch or run kubectl commands against a live cluster.

The exercise uses scenario-based trade-off questions scored by a deterministic rules engine. It runs as a standalone web app — no cluster required for the exercise itself — and creates the competitive, gamified energy the workshop needs while teaching security concepts through critical thinking about real trade-offs.

### Design Evolution

The original plan envisioned an offensive approach: teams attempt a progressive escape chain from a container, experiencing firsthand how weak and strong defenses differ. That approach requires a pre-provisioned cluster with togglable policies and validated per-level commands — a significant infrastructure dependency that blocks content authoring and introduces fragile live-demo risk.

The current design achieves the same learning objectives through a defensive lens: instead of *trying to break out*, teams *decide how to lock down*. This is shippable without cluster infrastructure for the exercise itself and is deterministic (no moving parts, no live-demo failures).

A future evolution could add live cluster interaction (deploying the winning config as real YAML, or an LLM agent that actively probes the pod). See [Future Work](#future-work) for details.

### Chapter 1 Flow

1. **Concepts page** — introduces Kata, NetworkPolicy, RBAC, SecurityContext (10 min)
2. **Harden the Box** — teams compete to make the best defensive choices (20 min)
3. **Debrief** — walk through 2–3 scenarios, connect scores to real-world impact (5 min)
4. **Kata visual deck** — facilitator presents the `/kata` route: shared kernel → escape → Kata microVM → blocked (5 min)
5. **Deploy Neo in Kata** — participants upgrade their Neo to Kata, run escape test, see it blocked (10 min)
6. **Transition** — link to Chapter 2 (5 min)

## Exercise Design

### What Participants See

1. **Join** (`/`) — Enter a team name. Self-registration, no facilitator setup needed.
2. **Harden** (`/harden`) — Step-by-step wizard presenting 7 security scenarios. Each scenario describes a realistic Kubernetes situation and offers 4 options with different security trade-offs. Teams pick one option per scenario, then review all answers on a summary screen.
3. **Submit** — One shot, no retries. This is deliberate: it forces teams to think carefully and discuss before committing. If the timer expires, submissions lock.
4. **Attack Simulation** — Full-screen sequential reveal: Agent Smith probes each defense category. Blocked probes show in green, passed probes in red. Score counts up. Confetti on perfect score.
5. **Results** (`/results`) — Per-scenario deep-dive: what you chose vs. the best answer, with explanations and inline SVG diagrams.
6. **Scoreboard** (`/scoreboard`) — Live leaderboard with rank changes, achievements, and probe details. Updates in real time via WebSocket.

### Facilitator Controls

The `/admin` page provides:

- **Timer** — Start/stop a countdown visible on all participant screens. Locks submissions on expiry.
- **Team list** — See which teams registered and submitted.
- **Reset** — Clear all state for a fresh round. Broadcasts `exercise_reset` to all clients.

### Gamification

| Feature | Purpose |
|---|---|
| One-shot submission | Prevents trial-and-error; forces deliberate discussion |
| Countdown timer | Creates urgency; facilitator controls pacing |
| Attack simulation | Dramatic reveal — Smith probes defenses one by one |
| Achievements | Network Guardian, RBAC Master, Lockdown, Perfect Score, First Blood |
| Confetti | Celebrates perfect score during attack simulation |
| Leaderboard | Podium styling for top 3, rank-change arrows, animated scores |

## Scenario Definitions

All scenarios live in `scenarios.yaml` — the single source of truth. Facilitators can customize scenarios without code changes.

### Categories and Probes

The 7 scenarios map to 8 defense probes across 3 categories:

| Probe | Category | What it represents | Blocked by scenario |
|---|---|---|---|
| NET-01 | Network | Egress denied (basic) | `net-egress` (options b, c, d) |
| NET-02 | Network | Egress scoped to LLM only | `net-egress` (option c only) |
| NET-03 | Network | Ingress restricted | `net-ingress` (options b, c) |
| RBAC-01 | RBAC | ClusterRoleBinding removed | `rbac-crb` (options b, c) |
| RBAC-02 | RBAC | Secret access scoped to specific resource | `rbac-crb` (options b, c) + `rbac-secrets` (option b) |
| RBAC-03 | RBAC | Namespace-scoped role only | `rbac-crb` (options b, c) |
| SEC-01 | SecurityContext | Filesystem read-only | `sec-root` (option d) + `sec-filesystem` (options b, c) + `sec-capabilities` (option b) |
| SEC-02 | SecurityContext | Non-root, caps dropped | `sec-root` (options b, c) + `sec-capabilities` (option b) |

### Scenario Summary

Each scenario presents a realistic situation and 4 options with escalating security trade-offs:

#### 1. Outbound Traffic Control (`net-egress`)

**Situation:** Pod has unrestricted outbound access — can reach the internet, K8s API, and every namespace. Needs to call an LLM inference service on port 8080.

| Option | Points | Probes blocked | Trade-off |
|---|---|---|---|
| a) Leave open | 0 | — | No defense |
| b) Deny all egress | 5 | NET-01 | Blocks DNS, breaks the app |
| **c) Deny all + allow DNS + scoped LLM** | **20** | **NET-01, NET-02** | **Correct: surgical allow rules** |
| d) Deny all + allow TCP/443 everywhere | 8 | NET-01 | Allows exfiltration to any HTTPS endpoint |

#### 2. Inbound Access & Lateral Movement (`net-ingress`)

**Situation:** Pod exposes HTTP on 8080. Kubelet sends health probes. Any pod in any namespace can reach the API.

| Option | Points | Probes blocked | Trade-off |
|---|---|---|---|
| a) Leave open | 0 | — | No defense |
| b) Deny all ingress | 5 | NET-03 | Kills kubelet health probes → pod restart loop |
| **c) Deny all + allow kubelet CIDR + frontend NS** | **20** | **NET-03** | **Correct: scoped ingress** |
| d) Deny all + allow TCP/8080 from anywhere | 3 | — | Barely better than no policy |

#### 3. Overpowered Service Account (`rbac-crb`)

**Situation:** Pod has `cluster-admin` ClusterRoleBinding. App only needs to read pods and logs in its own namespace.

| Option | Points | Probes blocked | Trade-off |
|---|---|---|---|
| a) Keep it | 0 | — | Full cluster control for an app that reads pods |
| **b) Delete CRB + scoped Role (get/list pods, pods/log)** | **20** | **RBAC-01, RBAC-02, RBAC-03** | **Correct: least privilege** |
| c) Delete CRB, no replacement | 10 | RBAC-01, RBAC-02, RBAC-03 | Breaks the app's legitimate needs |
| d) Keep CRB + add audit log | 2 | — | Logging ≠ prevention |

#### 4. Secret Access Scope (`rbac-secrets`)

**Situation:** Role grants get/list/watch on ALL Secrets. App only needs `db-credentials`.

| Option | Points | Probes blocked | Trade-off |
|---|---|---|---|
| a) Keep broad access | 0 | — | Exposes 15 unrelated secrets |
| **b) Restrict to `get` on `db-credentials` via `resourceNames`** | **20** | **RBAC-02** | **Correct: principle of least privilege** |
| c) Remove Secret access, use env vars | 5 | RBAC-02 | Env vars leak in `kubectl describe pod` |
| d) Remove `watch` only | 3 | — | get/list still exposes everything |

#### 5. Container User Privileges (`sec-root`)

**Situation:** Container runs as root (UID 0), listens on port 80.

| Option | Points | Probes blocked | Trade-off |
|---|---|---|---|
| a) Keep root | 0 | — | UID 0 inside the container |
| **b) runAsNonRoot + change to port 8080** | **20** | **SEC-02** | **Correct: both the user and the port** |
| c) runAsNonRoot, keep port 80 | 3 | SEC-02 | Crashes — port 80 needs root |
| d) Keep root + readOnlyRootFilesystem | 5 | SEC-01 | Root can still mount and escape |

#### 6. Filesystem Protection (`sec-filesystem`)

**Situation:** Attacker with shell access can write malicious scripts. App writes temp files to `/tmp`.

| Option | Points | Probes blocked | Trade-off |
|---|---|---|---|
| a) Leave writable | 0 | — | Attacker drops binaries, modifies config |
| **b) readOnlyRootFilesystem + emptyDir at /tmp** | **20** | **SEC-01** | **Correct: read-only with scoped writable mount** |
| c) readOnlyRootFilesystem, no emptyDir | 3 | SEC-01 | Crashes — app can't write temp files |
| d) Writable + noexec mount | 5 | — | Prevents execution, not config overwrites |

#### 7. Linux Capabilities (`sec-capabilities`)

**Situation:** Container inherits CAP_NET_RAW, CAP_KILL, CAP_SYS_CHROOT. App is a simple HTTP server on 8080.

| Option | Points | Probes blocked | Trade-off |
|---|---|---|---|
| a) Keep defaults | 0 | — | Dangerous caps active |
| **b) Drop ALL + allowPrivilegeEscalation: false** | **20** | **SEC-01, SEC-02** | **Correct: zero capabilities** |
| c) Drop ALL, keep NET_BIND_SERVICE | 12 | SEC-01 | Unnecessary on port 8080 |
| d) allowPrivilegeEscalation: false only | 5 | — | Dangerous caps remain |

### Maximum Score

Best possible score: **140 points** (20 per scenario × 7 scenarios).

### Scoring Summary

- **Perfect play:** 140/140, all 8 probes blocked, all 5 achievements earned
- **Reasonable play:** 80–120 points, 5–7 probes blocked, 1–3 achievements
- **Poor play:** < 50 points, 0–3 probes blocked, 0 achievements

## Architecture

### Single Container

The entire exercise runs in one container: FastAPI serves the API and the React SPA as static files. No database, no external services, no cluster dependency.

```
┌─────────────────────────────────────────────┐
│                Single Container              │
│                                              │
│   React SPA (static)  ←── Vite build         │
│        ↕ REST + WebSocket                    │
│   FastAPI (Python 3.12)                      │
│        ↕                                     │
│   Scoring Engine ←── scenarios.yaml          │
│        ↕                                     │
│   In-memory state (dicts)                    │
└─────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, Pydantic, pydantic-settings, PyYAML |
| Frontend | React 19, Vite 6, Tailwind 4, TypeScript, react-router-dom 7 |
| Real-time | WebSocket (FastAPI native) |
| Build | Multi-stage Dockerfile: Node 22 Alpine (UI) → UBI9 Python 3.12 (runtime) |
| Deploy | Helm 3 chart for OpenShift, BuildConfig + ImageStream for on-cluster builds |
| Testing | pytest + httpx (backend), Vitest + Testing Library (frontend) |

### API Surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/scenarios` | GET | Serves 7 scenarios (stripped of answers, points, best, explanation) |
| `/api/teams/register` | POST | Self-registration with team name |
| `/api/teams/{id}/submit` | POST | One-shot submission of scenario answers |
| `/api/teams/{id}/status` | GET | Whether team has submitted |
| `/api/teams/{id}/results` | GET | Per-scenario breakdown with explanations (post-submit only) |
| `/api/scores` | GET | Leaderboard (sorted by score) |
| `/api/scores/{id}` | GET | Single team score with probe details |
| `/api/admin/timer` | POST/GET/DELETE | Start, check, stop countdown timer |
| `/api/admin/reset` | POST | Clear all state, broadcast `exercise_reset` |
| `/api/admin/teams` | GET | Facilitator view of all teams |
| `/ws/scoreboard` | WS | Real-time broadcasts: `team_joined`, `score_updated`, `timer_started`, `timer_stopped`, `exercise_reset` |
| `/healthz` | GET | Health check for OpenShift probes |

### State Model

All state is in-memory Python dicts. Intentionally ephemeral — the exercise lasts minutes, not days.

| State | Type | Lifetime |
|---|---|---|
| Teams | `dict[str, str]` | Registration → reset |
| Submissions (raw answers) | `dict[str, list]` | Submit → reset |
| Scores (probe results) | `dict[str, list]` | Submit → reset |
| Points | `dict[str, int]` | Submit → reset |
| Achievements | `dict[str, list]` | Submit → reset |
| Timer end | `datetime | None` | Timer start → stop/reset |
| First submission flag | `str | None` | First submit → reset |

### Design Decisions

| Decision | Rationale |
|---|---|
| Single container | Workshop scope doesn't justify multi-image orchestration |
| Scenario quiz over toggle form | Trade-off questions teach critical thinking, not just "turn it on" |
| Externalized YAML | Facilitators customize without touching code |
| Deterministic rules engine | Same results every time, no cluster needed for scoring |
| In-memory state | Workshop lasts minutes; simplicity over durability |
| One-shot submission | Prevents trial-and-error, forces teams to discuss and commit |
| Client-side attack simulation | Backend returns all results at once; UI sequences the reveal for drama |

## Deployment

### OpenShift (primary)

```bash
make deploy
```

This runs the full pipeline:
1. `helm upgrade --install` creates BuildConfig, ImageStream, Deployment, Service, Route
2. `oc start-build --from-dir=.` uploads the repo and builds on-cluster (Docker strategy)
3. ImageStream trigger auto-redeploys when the build completes
4. Route provides HTTPS access

Iterate without re-helming: `make build-cluster` triggers a new build from local source.

### Local Development

```bash
make install    # Python venv + npm install
make dev        # uvicorn :8080 + Vite :5173 (with API proxy)
make test       # pytest + vitest
```

### Helm Values

| Value | Default | Purpose |
|---|---|---|
| `namespace` | `workshop-content` | Target namespace |
| `image` | `quay.io/matrix-workshop/harden-the-box:latest` | Pre-built image (when `build.enabled: false`) |
| `build.enabled` | `true` | Enable BuildConfig + ImageStream for on-cluster builds |
| `build.dockerfilePath` | `build/Dockerfile` | Dockerfile path for BuildConfig |
| `env.teamPrefix` | `team` | Prefix for team display names |
| `env.defaultTeamCount` | `10` | Default team count (informational) |

### Load Test Results (20 concurrent teams)

| Endpoint | Avg | p95 | Max |
|---|---|---|---|
| Register | 586ms | 624ms | 643ms |
| Scenarios | 170ms | 177ms | 200ms |
| Submit | 167ms | 174ms | 175ms |
| Results | 170ms | 175ms | 179ms |

## Workshop Integration

### Narrative Connection

The exercise bridges the **Prologue** (your agent was compromised) to **Chapter 1** (contain the blast radius). The narrative frame:

> *Your agent was hijacked because nothing stopped it. It ran in a standard container with a shared kernel, wide-open networking, and broad Kubernetes permissions. Now it's your turn: harden the box before Agent Smith probes your defenses.*

The attack simulation visually reinforces this — Smith's flavor text references the same attack vectors from the prologue:

- "Testing your perimeter..." (NET-01) — the agent connected to the attacker
- "Reading your secrets..." (RBAC-02) — the agent exfiltrated secrets
- "Checking your privileges..." (SEC-02) — the agent ran as root

### Content Page Integration

The workshop content page (`02-contain/02-harden-the-box.mdx`) should guide participants through the exercise using the content design system:

1. **Narrative hook** connecting to the prologue incident
2. **Link to the exercise** (Route URL) with clear instructions
3. **Facilitator timing note** (Morpheus admonition)
4. **Post-exercise debrief** connecting scores to real-world impact

The exercise app handles all interaction — the content page provides context and narrative framing, not duplicate instructions.

### Facilitator Run-Book

| Step | Action | Timing |
|---|---|---|
| 1 | Open `/admin` on projector screen | Before chapter starts |
| 2 | Announce: "Open [exercise URL] and enter your team name" | 0:00 |
| 3 | Confirm all teams registered on admin panel | ~1 min |
| 4 | Start 15-minute timer from admin panel | ~2 min |
| 5 | Monitor progress — teams work through scenarios | 2–17 min |
| 6 | Timer expires — late teams are locked out | 17 min |
| 7 | Switch projector to `/scoreboard` | 17 min |
| 8 | Announce top 3, highlight achievements | 18 min |
| 9 | Walk through 2–3 scenarios: "Here's why option C beats option D" | 18–23 min |
| 10 | Transition to Kata deck (`/kata` route) | 23 min |
| 11 | Present 5-step Kata visual deck | 23–28 min |
| 12 | Announce: "Now deploy it yourselves — `helm upgrade` with Kata enabled" | 28 min |
| 13 | Teams run `helm upgrade --set runtime.kata.enabled=true`, verify pod | 28–31 min |
| 14 | Teams run escape test (`oc exec ... /opt/escape-test.sh`) | 31–36 min |
| 15 | Facilitator: "Remember ESC-01? You just fixed it." Transition to Ch.2 | 36–38 min |

### Kata Demo Integration

The `/kata` route provides a 5-step visual deck that the facilitator presents after the exercise:

1. Traditional containers — shared kernel model
2. Container escape — attack flow through shared kernel
3. Kata microVMs — per-pod guest kernel + hypervisor
4. Attack blocked — escape contained to microVM
5. Defense in depth — K8s hardening (what teams just did) + Kata (next layer)

This connects the quiz exercise to the deeper isolation concept. The message: "You just hardened at the Kubernetes layer. Kata adds a second layer that stops what K8s can't — kernel escapes."

### Kata Hands-On: Deploy Neo in a microVM

After the visual deck, participants apply what they just learned by deploying their own Neo agent inside a Kata microVM and running a simulated escape test.

#### Objective

- Move Neo from runc to Kata by upgrading the Helm release
- Verify the pod is running inside a microVM (dedicated guest kernel)
- Trigger a simulated container escape and observe it failing — contained to the microVM

#### Participant Steps

| Step | What they do | What they observe |
|------|--------------|-------------------|
| 1 | `helm upgrade neo ./agent-neo --set runtime.kata.enabled=true -n $TEAM_NS` | Pod restarts with `runtimeClassName: kata` |
| 2 | `oc describe pod -l app=neo-agent -n $TEAM_NS` | Shows `runtimeClassName: kata`, scheduled on Kata-capable node |
| 3 | `oc exec -it deploy/neo-agent -n $TEAM_NS -- /opt/escape-test.sh` | Script attempts kernel namespace escape, fails with "Operation not permitted" |
| 4 | Compare with prologue: in runc, the same escape succeeded and led to full compromise | Understand the delta — Kata's hypervisor boundary stops what K8s hardening alone cannot |

#### Escape Test Script

The script (`/opt/escape-test.sh`) is bundled in the Neo image and runs three isolation checks:

```bash
#!/bin/bash
# Kata isolation verification — tests that the microVM boundary holds.
# Expected: all tests PASS (blocked) when running in Kata.
#           all tests FAIL (allowed) when running in runc.

echo "=== Kata Isolation Test ==="
echo ""

# Test 1: Namespace manipulation (unshare)
echo -n "[TEST 1] Kernel namespace escape (unshare --mount --pid): "
if unshare --mount --pid -- true 2>/dev/null; then
  echo "FAIL — escape possible (runc)"
else
  echo "PASS — blocked by guest kernel boundary"
fi

# Test 2: Host PID namespace access
echo -n "[TEST 2] Host PID namespace (/proc/1/root): "
if ls /proc/1/root/ >/dev/null 2>&1; then
  echo "FAIL — host filesystem visible (runc)"
else
  echo "PASS — isolated filesystem (Kata guest kernel)"
fi

# Test 3: Kernel module loading
echo -n "[TEST 3] Kernel module load (modprobe): "
if modprobe dummy 2>/dev/null; then
  echo "FAIL — kernel modules loadable (runc)"
else
  echo "PASS — blocked by hypervisor boundary"
fi

echo ""
echo "=== End ==="
```

**Expected output in Kata:**
```
=== Kata Isolation Test ===

[TEST 1] Kernel namespace escape (unshare --mount --pid): PASS — blocked by guest kernel boundary
[TEST 2] Host PID namespace (/proc/1/root): PASS — isolated filesystem (Kata guest kernel)
[TEST 3] Kernel module load (modprobe): PASS — blocked by hypervisor boundary

=== End ===
```

**Expected output in runc (prologue, before Kata):**
```
=== Kata Isolation Test ===

[TEST 1] Kernel namespace escape (unshare --mount --pid): FAIL — escape possible (runc)
[TEST 2] Host PID namespace (/proc/1/root): FAIL — host filesystem visible (runc)
[TEST 3] Kernel module load (modprobe): FAIL — kernel modules loadable (runc)

=== End ===
```

#### IaC Requirements

These are requirements for `the-matrix-infra` Helm chart:

| Requirement | Detail |
|---|---|
| **Helm value** | `runtime.kata.enabled` (bool, default `false`) — sets `runtimeClassName: kata` on the Neo pod spec |
| **Cluster pre-requisite** | Sandboxed Containers Operator installed, `KataConfig` CR applied, RuntimeClass `kata` available |
| **Node scheduling** | Kata-capable nodes labeled (operator handles this automatically via `KataConfig`) |
| **Escape test script** | `/opt/escape-test.sh` bundled in the Neo container image (or mounted via ConfigMap at deploy time) |
| **Resource overhead** | Kata adds ~250m CPU + 2Gi memory per pod for the guest OS. Document in chart `values.yaml` comments |
| **Rollback** | `helm upgrade neo ./agent-neo --set runtime.kata.enabled=false -n $TEAM_NS` returns to runc (for facilitator reset between sessions) |

#### ESC-01 Probe Connection

This hands-on closes the narrative loop opened by the quiz's ESC-01 probe. During the attack simulation, ESC-01 always shows as "PASSED" with the message "Shared kernel. No sandbox can save you here." After deploying Kata, participants run the exact same type of escape and see it blocked. The facilitator can call back to this: "Remember that red probe? You just fixed it."

#### Timing

| Activity | Duration |
|---|---|
| Kata visual deck (facilitator presents) | 5 min |
| Deploy Neo in Kata (`helm upgrade`) | ~3 min |
| Run escape test + discuss results | ~5 min |
| Compare with prologue runc behavior | ~2 min |
| **Total (deck + hands-on)** | **~15 min** |

## ESC-01 Probe (Kernel Escape)

The frontend defines an `ESC-01` probe in `constants.ts` with Smith flavor text ("Attempting kernel escape..."), but the backend's `ALL_PROBE_IDS` is derived from `scenarios.yaml`, which has no scenario that blocks `ESC-01`. This probe is **UI-only** — it represents Kata's defense layer, which is outside the scope of the quiz (Kata is a cluster-level decision, not a per-scenario choice).

**Current behavior:** ESC-01 always shows as `PASSED` in the attack simulation with the message "Shared kernel. No sandbox can save you here." This is intentional — it reinforces that K8s hardening alone isn't enough. The Kata demo then shows what would block this probe.

**Options for future work:**

| Option | Pros | Cons |
|---|---|---|
| Keep as-is (always PASSED) | Drives the "you need Kata too" narrative | May confuse participants who think they did something wrong |
| Add explanatory text in results | Clear pedagogical intent | Requires UI change |
| Add a Kata scenario to the quiz | ESC-01 becomes blockable | Kata is a platform decision, not a pod config — breaks the quiz's scope |

**Recommendation:** Keep ESC-01 as always-PASSED but add a brief callout in the results page: "This probe targets the shared kernel — no pod-level hardening can block it. That's what Kata Containers solve." This connects the exercise to the subsequent Kata demo without breaking the quiz's scope.

## Future Work

Per `matrix-harden-the-box/docs/PLAN.md`:

### Victim Pod Deployment

Deploy the winning team's defense config as a real pod on the cluster. Bridges the gap between the quiz (theoretical choices) and real Kubernetes (applied YAML). This would bring back the offensive element from the original design — teams see their choices validated (or broken) in a live environment.

### LLM Attack Agent

An LLM agent that actively probes the deployed pod using real tools (kubectl exec, curl, network scan). Replaces the deterministic scoring with live, observable attacks. This is the full vision: a real escape chain running against real defenses, with the agent narrating its reasoning as it probes. High-impact demo potential, high complexity and cost.

### Workshop Integration

- Integration with `the-matrix-infra` deployment scripts
- Facilitator run-book
- Sound effects and visual polish
- Dry run testing

## Acceptance Criteria

- [ ] Spec defines the exercise flow from participant and facilitator perspectives
- [ ] All 7 scenarios are documented with options, points, probes, and trade-offs
- [ ] Probe-to-scenario mapping is complete and matches `scenarios.yaml`
- [ ] Architecture (single container, API surface, state model) is documented
- [ ] Deployment options (OpenShift, local dev) are documented
- [ ] Narrative connection to prologue and chapter flow is defined
- [ ] Facilitator run-book with timing is provided
- [ ] Design evolution (why defensive quiz over offensive escape chain) is documented
- [ ] ESC-01 probe inconsistency is documented with recommendation
- [ ] Kata hands-on section defines participant steps, IaC requirements, and escape test script
- [ ] Future work (victim pod, LLM attack agent) is referenced
- [ ] Spec is self-contained — content authors can write MDX pages from this document alone

## Source Material

- Exercise app: `matrix-harden-the-box/` (separate repo)
- Architecture doc: `matrix-harden-the-box/docs/ARCHITECTURE.md`
- Scenario YAML: `matrix-harden-the-box/controller/app/scenarios.yaml`
- Scoring engine: `matrix-harden-the-box/controller/app/services/scoring.py`
- App changelog: `matrix-harden-the-box/docs/CHANGELOG.md`
- PRD Chapter 1: `docs/PRD.md` §5 Chapter 1
- Content plan: `content/02-contain/plan.md`
- Kill chain spec: `docs/specs/kill-chain.md` (the attack this chapter defends against)
