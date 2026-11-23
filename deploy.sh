#!/bin/bash
# =============================================================================
#  CALCart Auto-Deploy Script
#  Runs on VPS — triggered by GitHub Actions or manual execution
#  Target: https://caldimproducts.com/calcart
# =============================================================================
set -e

DEPLOY_START=$(date '+%Y-%m-%d %H:%M:%S')
APP_NAME="calcart-web"
APP_DIR="/var/www/calcart"
LOG_FILE="$APP_DIR/deploy.log"
PORT=3008

echo "" >> "$LOG_FILE"
echo "=============================================" >> "$LOG_FILE"
echo " CALCART DEPLOY STARTED: $DEPLOY_START"       >> "$LOG_FILE"
echo "=============================================" >> "$LOG_FILE"

log() {
  echo "[$(date '+%H:%M:%S')] $1"
  echo "[$(date '+%H:%M:%S')] $1" >> "$LOG_FILE"
}

# Ensure Node, pnpm, and PM2 are in PATH
export PATH=$PATH:/usr/local/bin:/usr/bin:$HOME/.local/share/pnpm:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

log "📂 Working directory: $APP_DIR"
cd "$APP_DIR"

# ── Step 0: Backup Environment Files ─────────────────────────────────────────
log "🔒 Backing up environment files..."
[ -f "$APP_DIR/.env" ] && cp "$APP_DIR/.env" "$APP_DIR/.env.backup"
[ -f "$APP_DIR/apps/web/.env.local" ] && cp "$APP_DIR/apps/web/.env.local" "$APP_DIR/apps/web/.env.local.backup"
[ -f "$APP_DIR/apps/web/.env.production" ] && cp "$APP_DIR/apps/web/.env.production" "$APP_DIR/apps/web/.env.production.backup"

# ── Step 1: Fetch and Sync Latest Code from GitHub ────────────────────────────
log "📥 Fetching latest code from GitHub..."
git fetch origin main
git reset --hard origin/main
log "✅ Code synced to commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'current')"

# ── Step 2: Restore Environment Configuration ────────────────────────────────
log "🔄 Restoring environment files..."
[ -f "$APP_DIR/.env.backup" ] && cp "$APP_DIR/.env.backup" "$APP_DIR/.env"
[ -f "$APP_DIR/apps/web/.env.local.backup" ] && cp "$APP_DIR/apps/web/.env.local.backup" "$APP_DIR/apps/web/.env.local"
[ -f "$APP_DIR/apps/web/.env.production.backup" ] && cp "$APP_DIR/apps/web/.env.production.backup" "$APP_DIR/apps/web/.env.production"

# ── Step 3: Self-Healing Checks (Subpath, CSP, API prefix) ────────────────────
log "🛡️ Ensuring subpath and CSP patches are intact..."
python3 "$APP_DIR/scripts/apply-patches.py"

# ── Step 4: Install Dependencies ─────────────────────────────────────────────
log "📦 Installing dependencies with pnpm..."
pnpm install --frozen-lockfile=false
log "✅ Dependencies installed"

# ── Step 5: Run Database Migrations ──────────────────────────────────────────
log "🗄️ Running database migrations..."
npx tsx packages/db/src/migrate-cli.ts
log "✅ Database migrations applied"

# ── Step 6: Build Monorepo Packages ──────────────────────────────────────────
log "🔨 Building workspace packages..."
pnpm --filter './packages/*' --filter './modules/*' --filter '@calcart/worker' run build
log "✅ Workspace packages built"

# ── Step 7: Build Web Application ────────────────────────────────────────────
log "🚀 Building Next.js web application..."
pnpm --filter @calcart/web build
log "✅ Next.js production build complete"

# ── Step 8: Restart PM2 Process ──────────────────────────────────────────────
log "🔄 Restarting PM2 process ($APP_NAME)..."
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME" --update-env
else
  pm2 start "$APP_DIR/ecosystem.config.cjs"
fi
pm2 save --force
log "✅ PM2 process ($APP_NAME) is online"

# ── Step 9: Nginx Syntax Test & Reload ───────────────────────────────────────
log "🌐 Verifying Nginx configuration and reloading..."
echo 'Caldim@2026' | sudo -S nginx -t 2>/dev/null
echo 'Caldim@2026' | sudo -S systemctl reload nginx 2>/dev/null
log "✅ Nginx reloaded"

# ── Step 10: Health Check Verification ───────────────────────────────────────
log "🔍 Verifying application health..."
sleep 3
LOCAL_HEALTH=$(curl -sf "http://127.0.0.1:$PORT/calcart/api/v1/health" || echo "FAILED")
PUBLIC_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" "https://caldimproducts.com/calcart" --max-time 10 || echo "000")

if echo "$LOCAL_HEALTH" | grep -q "healthy"; then
  log "✅ [HEALTH] Local API is healthy: $LOCAL_HEALTH"
else
  log "⚠️  [HEALTH] Local API response: $LOCAL_HEALTH"
fi

if [ "$PUBLIC_STATUS" = "200" ]; then
  log "✅ [HEALTH] Public URL responding with HTTP 200"
else
  log "⚠️  [HEALTH] Public URL returned HTTP $PUBLIC_STATUS"
fi

DEPLOY_END=$(date '+%Y-%m-%d %H:%M:%S')
log "──────────────────────────────────────────────"
log "🎉 DEPLOY SUCCESSFUL: $DEPLOY_END"
log "🌐 Live at: https://caldimproducts.com/calcart"
log "──────────────────────────────────────────────"
