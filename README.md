# QO100 Align Tool

Web-based dish alignment UI for Winterhill/Longmynd style MER monitoring.

## Features

- Connect to local WebSocket receiver (`ws://<ip>:<port>`)
- Large real-time MER display
- MER trend chart with target line
- Optional pitch tone based on MER
- BATC wideband FFT view + occupancy warning
- Mobile-friendly layout with fullscreen panel modes
- Multi-language UI

## Project Structure

- `src/index.html` app markup
- `src/styles.css` app styles
- `src/app.js` app logic
- `build.mjs` production minify build
- `dist/` generated production output (created by build)

## Requirements

- Node.js 18+ (recommended)
- npm

## Install

```bash
npm install
```

## Development

Serve unminified source from `src/`:

```bash
npm run dev
```

Default dev URL:

- `http://localhost:5173`

## Production Build (Minified)

Build minified HTML/CSS/JS into `dist/`:

```bash
npm run build
```

Serve built files:

```bash
npm run start
```

Default production URL:

- `http://localhost:4173`

## Clean Build Output

```bash
npm run clean
```

## Receiver Connection

Set receiver IP and port in the UI, then connect.

Typical default:

- IP: `192.168.10.47`
- Port: `8080`

The app stores last successful IP/port and restores it on next load.

## Debug Mode

Add `?debug=1` to URL to show payload debug panel:

- `http://localhost:5173/?debug=1`

## Raspberry Pi Notes

1. Install Node.js 18+ on the Pi.
2. Copy/clone this repo.
3. Run:

```bash
npm install
npm run build
npm run start
```

4. Open from iPhone browser on same network:

- `http://<raspberry-pi-ip>:4173`

If you prefer serving static files from another web server, deploy the contents of `dist/`.

