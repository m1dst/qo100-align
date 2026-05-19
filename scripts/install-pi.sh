#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -eq 0 ]]; then
  echo "Do not run this installer as root. Run as a normal user with sudo access."
  exit 1
fi

OWNER="m1dst"
REPO="qo100-align"
RELEASE_TAG="latest"
DIST_ARCHIVE="qo100-align-dist.tar.gz"
DIST_SHA_FILE="qo100-align-dist.sha256"
WEB_ROOT="/var/www/qo100-align"
NGINX_SITE="/etc/nginx/sites-available/qo100-align"

RELEASE_BASE_URL="https://github.com/${OWNER}/${REPO}/releases/download/${RELEASE_TAG}"
DIST_URL="${RELEASE_BASE_URL}/${DIST_ARCHIVE}"
DIST_SHA_URL="${RELEASE_BASE_URL}/${DIST_SHA_FILE}"

log() {
  echo "[qo100-align] $*"
}

log "Installing required OS packages"
sudo apt-get update
sudo apt-get install -y curl nginx ca-certificates tar

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

log "Downloading built website from GitHub release"
curl -fL "${DIST_URL}" -o "${tmp_dir}/${DIST_ARCHIVE}"
curl -fL "${DIST_SHA_URL}" -o "${tmp_dir}/${DIST_SHA_FILE}"

log "Verifying download checksum"
(
  cd "${tmp_dir}"
  sha256sum -c "${DIST_SHA_FILE}"
)

log "Deploying built files to ${WEB_ROOT}"
sudo rm -rf "${WEB_ROOT}"
sudo mkdir -p "${WEB_ROOT}"
sudo tar -xzf "${tmp_dir}/${DIST_ARCHIVE}" -C "${WEB_ROOT}"

log "Configuring Nginx site"
sudo tee "${NGINX_SITE}" >/dev/null <<EOF
server {
  listen 80 default_server;
  listen [::]:80 default_server;

  server_name _;

  root ${WEB_ROOT};
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

if [[ -L "/etc/nginx/sites-enabled/default" ]]; then
  sudo rm -f /etc/nginx/sites-enabled/default
fi

sudo ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/qo100-align

log "Validating and restarting Nginx"
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

PI_IP="$(hostname -I | awk '{print $1}')"
log "Install complete"
echo "Open: http://${PI_IP}/"
echo ""
echo "Note: This is HTTP on port 80 (no TLS), which avoids browser mixed-content blocking for ws:// receiver connections."
