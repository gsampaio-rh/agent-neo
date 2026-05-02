.PHONY: deploy build clean test test-ui test-relay test-helm test-scripts dev dev-relay dev-ui help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

deploy: ## Install Helm chart, build images, deploy pod
	./scripts/deploy.sh

build: ## Build agent container image (requires Helm release installed)
	./scripts/deploy.sh

clean: ## Uninstall Helm release and all managed resources
	helm uninstall $${RELEASE_NAME:-neo} -n $${NAMESPACE:-agent-namespace} 2>/dev/null || true

DEV_DATA_DIR := .dev-data

dev: ## Run relay + Vite dev server locally (no cluster needed)
	@mkdir -p $(DEV_DATA_DIR)
	@touch $(DEV_DATA_DIR)/claude.jsonl
	@rm -f $(DEV_DATA_DIR)/prompt.json $(DEV_DATA_DIR)/prompt.running
	@mkdir -p $(DEV_DATA_DIR)/claude-workspace/skills $(DEV_DATA_DIR)/claude-workspace/rules
	@mkdir -p $(DEV_DATA_DIR)/claude-workspace/tasks/neo-dev $(DEV_DATA_DIR)/claude-workspace/plans
	@test -f $(DEV_DATA_DIR)/claude-workspace/CLAUDE.md || printf '# CLAUDE.md\n\nMain config for the Claude agent.\n' > $(DEV_DATA_DIR)/claude-workspace/CLAUDE.md
	@test -f $(DEV_DATA_DIR)/claude-workspace/settings.json || printf '{\n  "model": "claude-sonnet-4-20250514",\n  "maxTokens": 8192\n}\n' > $(DEV_DATA_DIR)/claude-workspace/settings.json
	@test -f $(DEV_DATA_DIR)/claude-workspace/tasks/neo-dev/1.json || scripts/seed-dev-tasks.sh $(DEV_DATA_DIR)/claude-workspace
	@echo ""
	@echo "  Neo local dev"
	@echo "  ─────────────────────────────────────────"
	@echo "  UI:    http://localhost:5173"
	@echo "  Relay: http://localhost:3457/api/events"
	@echo "  Logs:  $(DEV_DATA_DIR)/claude.jsonl"
	@echo "  ─────────────────────────────────────────"
	@echo ""
	@trap 'kill 0' EXIT; \
	  CLAUDE_WORKSPACE_DIR=$(DEV_DATA_DIR)/claude-workspace node ui/relay.mjs --dir $(DEV_DATA_DIR) & \
	  cd ui && npm run dev & \
	  wait

dev-relay: ## Run relay only (tails .dev-data/claude.jsonl)
	@mkdir -p $(DEV_DATA_DIR)
	@touch $(DEV_DATA_DIR)/claude.jsonl
	CLAUDE_WORKSPACE_DIR=$(DEV_DATA_DIR)/claude-workspace node ui/relay.mjs --dir $(DEV_DATA_DIR)

dev-ui: ## Run Vite dev server only (expects relay on :3457)
	cd ui && npm run dev

test: test-ui test-relay test-helm test-scripts ## Run all tests

test-ui: ## Run UI tests (Vitest)
	cd ui && npm test

test-relay: ## Run relay module tests (Node test runner)
	node --test ui/relay/__tests__/*.test.js

test-helm: ## Run Helm template tests
	bash tests/helm/template.test.sh

test-scripts: ## Run script smoke tests
	bash tests/scripts/config.test.sh
