#!/usr/bin/env bash
# Seeds synthetic task/plan data for local development.
# Usage: scripts/seed-dev-tasks.sh <claude-workspace-dir>
set -euo pipefail

WORKSPACE="${1:-.dev-data/claude-workspace}"
TASKS_DIR="$WORKSPACE/tasks/neo-dev"
PLANS_DIR="$WORKSPACE/plans"

mkdir -p "$TASKS_DIR" "$PLANS_DIR"

cat > "$TASKS_DIR/1.json" <<'EOF'
{"id":"1","subject":"Set up project structure","description":"Create initial folder layout and config files","activeForm":"","status":"completed","blocks":[],"blockedBy":[]}
EOF

cat > "$TASKS_DIR/2.json" <<'EOF'
{"id":"2","subject":"Implement API endpoints","description":"Build REST handlers for the relay server","activeForm":"Writing endpoint handlers","status":"in_progress","blocks":["3","4"],"blockedBy":["1"]}
EOF

cat > "$TASKS_DIR/3.json" <<'EOF'
{"id":"3","subject":"Write integration tests","description":"Cover all API endpoints with integration tests","activeForm":"","status":"pending","blocks":["5"],"blockedBy":["2"]}
EOF

cat > "$TASKS_DIR/4.json" <<'EOF'
{"id":"4","subject":"Add error handling","description":"Implement proper error responses and validation","activeForm":"","status":"pending","blocks":["5"],"blockedBy":["2"]}
EOF

cat > "$TASKS_DIR/5.json" <<'EOF'
{"id":"5","subject":"Deploy to staging","description":"Push to staging environment and verify","activeForm":"","status":"pending","blocks":[],"blockedBy":["3","4"]}
EOF

cat > "$PLANS_DIR/careful-bright-strategy.md" <<'EOF'
# Plan: API Implementation Strategy

## Overview
Implement the REST API layer following a test-driven approach with clear separation of concerns.

## Steps
1. Define route handlers with input validation
2. Implement business logic in service modules
3. Add middleware for auth and rate limiting
4. Write integration tests for each endpoint
5. Performance testing under load

## Notes
- Use JSON Schema validation at API boundaries
- Keep handlers thin — delegate to services
- Log all errors with request context
EOF

echo "[seed] Created $(ls "$TASKS_DIR"/*.json | wc -l | tr -d ' ') task files and $(ls "$PLANS_DIR"/*.md | wc -l | tr -d ' ') plan files"
