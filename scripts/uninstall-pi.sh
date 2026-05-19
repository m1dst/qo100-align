#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do not run this uninstaller as root. Run as a normal user with sudo access."
  exit 1
fi

INSTALL_ROOT="/opt/qo100-align"
WEB_ROOT="/var/www/qo100-align"
NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/qo100-align"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/qo100-align"

log() {
  echo "[qo100-align] $*"
}

log "Stopping and disabling Nginx"
sudo systemctl stop nginx || true
sudo systemctl disable nginx || true

log "Removing QO100 Align Nginx site config"
sudo rm -f "${NGINX_SITE_ENABLED}"
sudo rm -f "${NGINX_SITE_AVAILABLE}"

if [[ ! -e /etc/nginx/sites-enabled/default && -e /etc/nginx/sites-available/default ]]; then
  log "Re-enabling default Nginx site"
  sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi

log "Removing deployed website files"
sudo rm -rf "${WEB_ROOT}"

log "Removing source checkout"
sudo rm -rf "${INSTALL_ROOT}"

if command -v nginx >/dev/null 2>&1; then
  log "Validating Nginx config"
  sudo nginx -t || true
fi

log "Uninstall complete"
echo "Nginx package is still installed. Remove it with: sudo apt-get remove --purge -y nginx nginx-common"
echo "Node.js package is still installed. Remove it with: sudo apt-get remove --purge -y nodejs"
