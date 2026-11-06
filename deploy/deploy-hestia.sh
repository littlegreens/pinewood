#!/usr/bin/env bash
# Deploy Pinewood su VPS Hestia: pull Git ? build ? sync ? restart PM2
# Esegui SUL SERVER (root o utente con permessi su path Hestia):
#   bash /var/www/pinewood/deploy/deploy-hestia.sh
#
# Prima volta: vedi DEPLOY_HESTIA.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=hestia.env
source "${SCRIPT_DIR}/hestia.env"

# Node via nvm (SSH non-interattivo non carica .bashrc)
export NVM_DIR="${NVM_DIR:-/root/.nvm}"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "${NVM_DIR}/nvm.sh"
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[deploy-hestia] ERRORE: npm non trovato nel PATH" >&2
  exit 1
fi

GIT_ROOT="${PINWOOD_GIT_ROOT}"
PUBLIC_HTML="${PINWOOD_PUBLIC_HTML}"
SERVER_DIR="${PINWOOD_SERVER}"
UPLOADS="${PINWOOD_UPLOADS}"

log() { echo "[deploy-hestia] $*"; }

if [[ ! -d "${GIT_ROOT}/.git" ]]; then
  log "ERRORE: ${GIT_ROOT}/.git non trovato."
  log "Esegui il setup iniziale (DEPLOY_HESTIA.md § Setup Git)."
  exit 1
fi

if [[ ! -f "${SERVER_DIR}/.env" ]]; then
  log "ERRORE: manca ${SERVER_DIR}/.env (copia dal backup prima del primo deploy)."
  exit 1
fi

log "git pull in ${GIT_ROOT}"
cd "${GIT_ROOT}"
git pull --ff-only

log "backend: npm ci"
cd "${GIT_ROOT}/server"
npm ci

log "frontend: npm ci + build"
cd "${GIT_ROOT}/client"
npm ci
npm run build

log "sync frontend ? ${PUBLIC_HTML}"
mkdir -p "${PUBLIC_HTML}"
rsync -a --delete \
  --exclude='.gitkeep' \
  "${GIT_ROOT}/client/dist/" "${PUBLIC_HTML}/"

log "sync backend (esclusi node_modules, .env, uploads)"
mkdir -p "${SERVER_DIR}" "${UPLOADS}/avatars" "${UPLOADS}/gpx"
rsync -a \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='uploads' \
  "${GIT_ROOT}/server/" "${SERVER_DIR}/"

log "npm ci in ${SERVER_DIR}"
cd "${SERVER_DIR}"
npm ci --omit=dev 2>/dev/null || npm ci

log "restart PM2 (${PINWOOD_PM2_APP})"
if pm2 describe "${PINWOOD_PM2_APP}" >/dev/null 2>&1; then
  pm2 restart "${PINWOOD_PM2_APP}"
else
  pm2 start "${GIT_ROOT}/deploy/pm2/ecosystem.hestia.config.cjs"
fi
pm2 save

log "health check"
curl -sf "http://127.0.0.1:${PINWOOD_API_PORT}/api/health" | head -c 200
echo ""
log "OK — ${PINWOOD_OFFICIAL_URL}"
