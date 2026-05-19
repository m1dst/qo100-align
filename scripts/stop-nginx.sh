#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[qo100-align] $*"
}

log "Stopping Nginx"
sudo systemctl stop nginx
log "Nginx stopped"
