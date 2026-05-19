# Raspberry Pi Install Guide (HTTP Port 80)

This project can fail when served with TLS (`https://`) because browsers block mixed content: a secure page cannot open an insecure WebSocket (`ws://...`).

The installer below sets up:

- Nginx web server
- Hosting on `http://<pi-ip>/` (port 80)
- Download of a prebuilt website artifact from GitHub Releases

## One-Line Install (from GitHub)

Run this on the Raspberry Pi terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/m1dst/qo100-align/master/scripts/install-pi.sh | bash
```

## What the Script Does

1. Installs system packages: `curl`, `nginx`, certificates.
2. Downloads the latest prebuilt website release artifact.
3. Verifies SHA256 checksum.
4. Deploys files to `/var/www/qo100-align`.
5. Configures Nginx to serve the site on port 80.
6. Restarts Nginx and prints the Pi URL.

## Build Pipeline (GitHub Actions)

- On every push to `master`, GitHub Actions builds `dist/`.
- CI publishes:
  - `qo100-align-dist.tar.gz`
  - `qo100-align-dist.sha256`
- The installer always deploys from the latest published release assets.

## How to Use After Install

- Open a browser on the same network: `http://<raspberry-pi-ip>/`
- In the app, set your receiver IP and port (for example `192.168.10.47:8080`).

## Stop Nginx

If you want to stop serving the website temporarily:

```bash
curl -fsSL https://raw.githubusercontent.com/m1dst/qo100-align/master/scripts/stop-nginx.sh | bash
```

## Uninstall

If you want to remove the deployed site and its Nginx config:

```bash
curl -fsSL https://raw.githubusercontent.com/m1dst/qo100-align/master/scripts/uninstall-pi.sh | bash
```

This uninstaller removes:

- `/opt/qo100-align` (legacy path from older installer versions)
- `/var/www/qo100-align`
- `/etc/nginx/sites-available/qo100-align`
- `/etc/nginx/sites-enabled/qo100-align`

It leaves packages installed (`nginx`, `nodejs`) and prints optional commands to remove them.

## Re-Run to Update

Re-running the same install command will download the newest release artifact and redeploy.

## Troubleshooting

- Check Nginx status:

```bash
sudo systemctl status nginx
```

- Validate Nginx config:

```bash
sudo nginx -t
```

- Start Nginx again:

```bash
sudo systemctl start nginx
```

- If install fails with a 404 on release files, wait for the CI workflow on `master` to finish and publish assets.
- If page loads but receiver does not connect, verify receiver IP/port and LAN reachability.
