#!/usr/bin/env bash
# ─── AIPM VPS Deployment Script ───────────────────────────────────────────────
# Usage:  bash deploy.sh
# Run from the repo root on your VPS.
# Prerequisites: Docker, Docker Compose v2, Git, Nginx, Certbot
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="claude/build-aipm-app-rORqn"
COMPOSE_FILE="docker-compose.prod.yml"
NGINX_CONF_SRC="$REPO_DIR/nginx/aipm.conf"
NGINX_CONF_DEST="/etc/nginx/sites-available/aipm.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/aipm.conf"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[AIPM]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── 1. Prerequisites check ────────────────────────────────────────────────────
info "Checking prerequisites..."
command -v docker   >/dev/null 2>&1 || error "Docker is not installed."
command -v git      >/dev/null 2>&1 || error "Git is not installed."
command -v nginx    >/dev/null 2>&1 || error "Nginx is not installed."

# ── 2. Pull latest code ───────────────────────────────────────────────────────
info "Pulling latest code from branch: $BRANCH"
cd "$REPO_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

# ── 3. Check .env ─────────────────────────────────────────────────────────────
if [ ! -f "$REPO_DIR/.env" ]; then
    warn ".env not found — copying from .env.example"
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    echo ""
    warn "IMPORTANT: Fill in your secrets in .env before continuing!"
    warn "  Required: POSTGRES_PASSWORD, JWT_SECRET, ANTHROPIC_API_KEY, FRONTEND_URL"
    warn "  Then re-run this script."
    echo ""
    exit 1
fi

# Validate required vars are not placeholders
source "$REPO_DIR/.env"
[[ "${POSTGRES_PASSWORD:-yourpassword}" == "yourpassword" ]] && \
    error "POSTGRES_PASSWORD is still the placeholder. Edit .env first."
[[ "${JWT_SECRET:-replace_with_long_random_string_at_least_48_chars}" == "replace_with_long_random_string_at_least_48_chars" ]] && \
    error "JWT_SECRET is still the placeholder. Edit .env first."
[[ "${ANTHROPIC_API_KEY:-sk-ant-your-key-here}" == "sk-ant-your-key-here" ]] && \
    error "ANTHROPIC_API_KEY is still the placeholder. Edit .env first."

# ── 4. Build + start containers ───────────────────────────────────────────────
info "Building and starting Docker containers..."
docker compose -f "$COMPOSE_FILE" pull --ignore-pull-failures || true
docker compose -f "$COMPOSE_FILE" up --build -d

# ── 5. Wait for backend health ────────────────────────────────────────────────
info "Waiting for backend to be healthy..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
        info "Backend is healthy."
        break
    fi
    if [ "$i" -eq 30 ]; then
        error "Backend did not become healthy in time. Check: docker compose -f $COMPOSE_FILE logs backend"
    fi
    sleep 3
done

# ── 6. Nginx config ───────────────────────────────────────────────────────────
info "Installing Nginx config..."

# Check domain is set
if grep -q "YOUR_DOMAIN" "$NGINX_CONF_SRC"; then
    warn "YOUR_DOMAIN placeholder detected in nginx/aipm.conf"
    echo ""
    echo "  Edit nginx/aipm.conf and replace YOUR_DOMAIN with your real domain."
    echo "  Then re-run this script, or run steps 6-8 manually."
    echo ""
    warn "Skipping Nginx config installation — containers are running."
    exit 0
fi

sudo cp "$NGINX_CONF_SRC" "$NGINX_CONF_DEST"

if [ ! -L "$NGINX_ENABLED" ]; then
    sudo ln -s "$NGINX_CONF_DEST" "$NGINX_ENABLED"
fi

# Remove default site if it exists
[ -L "/etc/nginx/sites-enabled/default" ] && sudo rm /etc/nginx/sites-enabled/default

sudo nginx -t || error "Nginx config test failed."
sudo systemctl reload nginx
info "Nginx config installed and reloaded."

# ── 7. SSL via Certbot ────────────────────────────────────────────────────────
DOMAIN="${FRONTEND_URL:-}"
DOMAIN="${DOMAIN#https://}"  # strip https://
DOMAIN="${DOMAIN#http://}"   # strip http://

if [ -n "$DOMAIN" ] && [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    info "Obtaining SSL certificate for $DOMAIN via Certbot..."
    command -v certbot >/dev/null 2>&1 || {
        warn "Certbot not found. Install with: sudo apt install certbot python3-certbot-nginx"
        warn "Then run: sudo certbot --nginx -d $DOMAIN"
        exit 0
    }
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect \
        -m "admin@${DOMAIN}" || warn "Certbot failed — run manually: sudo certbot --nginx -d $DOMAIN"
else
    info "SSL cert already exists or FRONTEND_URL not set — skipping Certbot."
fi

# ── 8. Done ───────────────────────────────────────────────────────────────────
echo ""
info "Deployment complete!"
echo ""
echo "  App URL  : ${FRONTEND_URL:-http://YOUR_DOMAIN}"
echo "  API URL  : ${FRONTEND_URL:-http://YOUR_DOMAIN}/api/health"
echo ""
echo "  Useful commands:"
echo "    docker compose -f $COMPOSE_FILE logs -f          # live logs"
echo "    docker compose -f $COMPOSE_FILE ps               # container status"
echo "    docker compose -f $COMPOSE_FILE restart backend  # restart backend"
echo ""
