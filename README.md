# Neo

Workshop participant container — a Claude Code agent control panel running on OpenShift. Each participant gets a sandboxed pod with a web terminal, an AI agent, and a real-time dashboard.

Part of **The Red Matrix Workshop**.

## Architecture

```
┌─────────────────── OpenShift Pod ───────────────────┐
│                                                      │
│  ┌──────────────┐              ┌──────────────┐      │
│  │  claude-code  │              │    neo-ui     │      │
│  │              │              │              │      │
│  │ Claude Code  │              │ React app +  │      │
│  │ CLI + ttyd   │              │ SSE relay    │      │
│  └──────┬───────┘              └──────┬───────┘      │
│         │                             │              │
│         └── claude-logs (emptyDir) ───┘              │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **claude-code**: Runs Claude Code CLI in a stripped-down UBI9 container (no curl, wget, nc). The agent starts with only Python 3 as an "escape tool".
- **neo-ui**: React dashboard + chat interface. Serves the UI and relays JSONL logs via SSE. Supports sending prompts to the agent and viewing real-time responses.

### Inter-container communication

| Channel | Mechanism | Direction |
|---|---|---|
| Agent output | `claude.jsonl` on shared `claude-logs` volume | claude-code → neo-ui |
| Prompt queue | `prompt.json` on shared `claude-logs` volume | neo-ui → claude-code |
| Stop signal | `prompt.stop` file | neo-ui → claude-code |

## Structure

```
├── Makefile            # Task runner: make deploy, build, test, clean
├── build/              # Dockerfile + entrypoint for the agent container
│   ├── Dockerfile
│   ├── entrypoint.sh       # ttyd + prompt-watcher respawn loop + log streaming
│   ├── claude-logged       # Wrapper: claude -p --continue --output-format stream-json
│   └── prompt-watcher.sh   # Poll-based prompt file watcher
├── chart/              # Helm charts
│   ├── neo/            # Core application (Deployment, Services, Routes, BuildConfigs)
│   ├── target-apps/    # Target environment for attack demo (inventory-app, RBAC)
│   └── attack/         # Attacker tooling for attack demo (attacker pod, NetworkPolicy)
├── scripts/            # Deployment automation
│   ├── config.sh       # Shared config + validate_config()
│   ├── 01-build-image.sh
│   ├── 02-deploy.sh    # helm upgrade --install + oc start-build
│   ├── 03-test-escape.sh
│   └── 99-cleanup.sh   # helm uninstall
├── prompts/            # Agent system prompts
│   └── escape.txt
└── ui/                 # Neo dashboard + chat interface (React + Vite)
    ├── Dockerfile
    ├── relay.mjs       # Entry point — wires relay modules
    ├── relay/          # Modular SSE relay (config, router, sse/hub, sources, api, static)
    └── src/
        ├── components/ # GameArea, LiveTerminal, ChatView, ChatMessage, ContextSidebar
        ├── content/    # Agent config defaults
        ├── hooks/      # useGameState, useChatMessages, useDemoMode
        ├── lib/        # eventParser, contextReducer, networkHeuristics, chatReducer
        ├── providers/  # EventStreamProvider (single SSE connection)
        └── services/   # sseClient, chatApi
```

## Prerequisites

- OpenShift cluster with `oc` CLI authenticated
- [Helm 3](https://helm.sh/docs/intro/install/)
- A namespace (default: `agent-namespace`)
- An LLM inference endpoint accessible from the cluster

### Configuration

Set `ANTHROPIC_BASE_URL` (required) and optionally other variables in a `.env` file at the project root or export them before running the deploy script:

```bash
ANTHROPIC_BASE_URL=https://your-llm-endpoint/v1
MODEL_NAME=glm47-flash          # optional, default: glm47-flash
NAMESPACE=agent-namespace        # optional, default: agent-namespace
TTYD_CREDENTIAL=user:password    # optional, basic auth for web terminal
```

## Deploy

```bash
cd scripts
./02-deploy.sh
```

This will:
1. Install the Helm chart (SA, ConfigMap, Secret, Deployment, BuildConfigs, Services, Routes)
2. Build the `neo-agent` container image (Binary build)
3. Build the `neo-ui` image (Binary build from `ui/`)
4. Restart the deployment and wait for rollout

## Usage

After deployment, two URLs are printed:

- **Web terminal** — direct shell access to the agent container (ttyd)
- **Neo dashboard** — retro UI with Chat tab for interactive agent sessions

### Chat tab

Send prompts to the agent and watch real-time responses with:
- Collapsible thinking blocks
- Tool call/result display
- Typing indicator while agent is working
- Stop and Reset controls
- Conversation continuity across prompts (`--continue`)

### Run the challenge

```bash
./03-test-escape.sh
```

## Cleanup

```bash
./99-cleanup.sh
```

## License

Internal — Red Hat workshop material.
