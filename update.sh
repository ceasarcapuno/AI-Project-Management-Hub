#!/usr/bin/env bash
# ─── AIPM One-Command Update Script ───────────────────────────────────────────
# Usage:  bash update.sh
# Run from /opt/aipm on your VPS after Claude pushes new code.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="claude/build-aipm-app-rORqn"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.prod.yml"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[AIPM]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

# 1. Pull latest code
info "Pulling latest code from $BRANCH..."
cd "$REPO_DIR"
git fetch origin "$BRANCH"
git pull origin "$BRANCH"

# 2. Rebuild and restart containers
info "Rebuilding containers..."
$COMPOSE up --build -d

# 3. Verify health
info "Waiting for backend health..."
for i in $(seq 1 20); do
  if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    info "Backend is healthy."
    break
  fi
  [ "$i" -eq 20 ] && { warn "Backend health check timed out. Check logs:"; echo "  $COMPOSE logs backend"; exit 1; }
  sleep 3
done

echo ""
info "Update complete! App is live at https://aipm.waresmith.tech"
echo ""
echo "  Logs : $COMPOSE logs -f"
echo "  Status: $COMPOSE ps"
echo ""
