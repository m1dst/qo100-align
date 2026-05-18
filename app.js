const wsStatus = document.getElementById("wsStatus");
const wsIpInput = document.getElementById("wsIp");
const wsPortInput = document.getElementById("wsPort");
const rxSelectEl = document.getElementById("rxSelect");
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const globalExitFsBtn = document.getElementById("globalExitFsBtn");
const merValueEl = document.getElementById("merValue");
const merMetaEl = document.getElementById("merMeta");
const rxMetaEl = document.getElementById("rxMeta");
const debugLogEl = document.getElementById("debugLog");
const debugPanelEl = document.querySelector(".debug-panel");
const chartLegendEl = document.getElementById("chartLegend");
const trendMerEl = document.getElementById("trendMer");
const wbStatusEl = document.getElementById("wbStatus");
const merWbStatusEl = document.getElementById("merWbStatus");
const wbFftWrapEl = document.getElementById("wbFftWrap");
const wbFftCanvas = document.getElementById("wbFftCanvas");
const wbFftCtx = wbFftCanvas.getContext("2d");
const clearChartBtn = document.getElementById("clearChartBtn");
const merFullscreenBtn = document.getElementById("merFullscreenBtn");
const trendFullscreenBtn = document.getElementById("trendFullscreenBtn");
const wbFullscreenBtn = document.getElementById("wbFullscreenBtn");
const toneEnabledEl = document.getElementById("toneEnabled");
const dishSizeSelectEl = document.getElementById("dishSizeSelect");
const toneMinMerEl = document.getElementById("toneMinMer");
const toneMaxMerEl = document.getElementById("toneMaxMer");
const canvas = document.getElementById("merChart");
const ctx = canvas.getContext("2d");

const DEMOD_MAP = {
  0: "Initializing",
  1: "Hunting",
  2: "Header",
  3: "Lock DVB-S",
  4: "Lock DVB-S2"
};

let ws;
let merPoints = [];
const maxPoints = 360;
let lastMer = null;
let audioCtx = null;
let oscillator = null;
let gainNode = null;
let canvasReady = false;
const rxOptionMap = new Map();
const debugMode = new URLSearchParams(window.location.search).has("debug");
let activeExpectedRange = null;
let batcWs = null;
let batcReconnectTimer = null;
let pseudoFullscreenEl = null;
let merRefitTimeout = null;

const DISH_MER_PRESETS = {
  "60": { min: 4.5, max: 8.5 },
  "75": { min: 5.5, max: 9.5 },
  "90": { min: 6.5, max: 10.5 },
  "100": { min: 7.0, max: 11.0 },
  "110": { min: 7.3, max: 11.3 },
  "120": { min: 7.5, max: 11.5 },
  "150": { min: 8.0, max: 12.5 }
};
const BATC_WB_WS_URL = "wss://eshail.batc.org.uk/wb/fft";
let wbFftReady = false;

function setUiConnected(isConnected) {
  document.body.classList.toggle("disconnected", !isConnected);
}

function setStatus(text, ok = false) {
  if (!wsStatus) return;
  wsStatus.textContent = text;
  wsStatus.style.background = ok ? "#1f9f57" : "#00000055";
}

function isIOSLike() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function disableIOSZoomGestures() {
  if (!isIOSLike()) return;

  document.addEventListener("gesturestart", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (e) => e.preventDefault(), { passive: false });
  document.addEventListener("gestureend", (e) => e.preventDefault(), { passive: false });

  // Block pinch zoom via touch events
  document.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // Block double-tap zoom (but do not interfere with button/input controls)
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
}

function updateDynamicViewportHeightVar() {
  const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--app-dvh", `${Math.round(vh)}px`);
}

function fitMerValueToWidth() {
  if (!merValueEl) return;
  const parent = merValueEl.parentElement;
  if (!parent) return;
  // Keep a safety gutter so glyphs never clip at the card edge on mobile.
  const available = Math.max(10, parent.clientWidth - 24);
  const text = (merValueEl.textContent || "").trim();
  if (!text) return;

  const style = getComputedStyle(merValueEl);
  const family = style.fontFamily || "sans-serif";
  const weight = style.fontWeight || "900";
  const letterSpacing = parseFloat(style.letterSpacing || "0");

  const canvasMeasure = fitMerValueToWidth._canvas || (fitMerValueToWidth._canvas = document.createElement("canvas"));
  const mctx = canvasMeasure.getContext("2d");
  if (!mctx) return;

  const measure = (sizePx) => {
    mctx.font = `${weight} ${sizePx}px ${family}`;
    const baseWidth = mctx.measureText(text).width;
    // Negative tracking can cause underestimation and clipping; ignore it for fit math.
    const spacing = Number.isFinite(letterSpacing)
      ? Math.max(0, letterSpacing) * Math.max(0, text.length - 1)
      : 0;
    return baseWidth + spacing;
  };

  let low = 24;
  let high = Math.max(24, Math.floor(window.innerHeight * 0.9));
  let best = low;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (measure(mid) <= available) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const heightCap = Math.max(28, Math.floor(parent.clientHeight * 0.70));
  merValueEl.style.fontSize = `${Math.min(best, heightCap)}px`;
}

function scheduleMerRefitBurst() {
  // Rotation/layout settles across a few frames on iOS; refit repeatedly.
  requestAnimationFrame(() => {
    fitMerValueToWidth();
    requestAnimationFrame(() => {
      fitMerValueToWidth();
      requestAnimationFrame(() => {
        fitMerValueToWidth();
      });
    });
  });

  if (merRefitTimeout) clearTimeout(merRefitTimeout);
  merRefitTimeout = setTimeout(() => {
    fitMerValueToWidth();
  }, 120);
}

function enterPseudoFullscreen(element) {
  if (pseudoFullscreenEl === element) return;
  if (pseudoFullscreenEl) pseudoFullscreenEl.classList.remove("pseudo-fullscreen");
  pseudoFullscreenEl = element;
  pseudoFullscreenEl.classList.add("pseudo-fullscreen");
  document.body.classList.add("pseudo-fullscreen-active");
  globalExitFsBtn.hidden = false;
  // iOS Safari portrait can keep old scroll offset; force top for reliable full-viewport overlay.
  window.scrollTo(0, 0);
}

function exitPseudoFullscreen() {
  if (!pseudoFullscreenEl) return;
  pseudoFullscreenEl.classList.remove("pseudo-fullscreen");
  pseudoFullscreenEl = null;
  document.body.classList.remove("pseudo-fullscreen-active");
  if (!document.fullscreenElement) globalExitFsBtn.hidden = true;
}

async function exitAnyFullscreen() {
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch {}
  }
  exitPseudoFullscreen();
  globalExitFsBtn.hidden = true;
  resizeChartCanvas();
  if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
}

function setWbStatus(text, level = "") {
  const display = text.replace("Occupancy Warning: ", "Occupancy Warning:<wbr> ");
  wbStatusEl.innerHTML = display;
  wbStatusEl.classList.remove("ok", "warn");
  if (level) wbStatusEl.classList.add(level);

  merWbStatusEl.innerHTML = display;
  merWbStatusEl.classList.remove("ok", "warn");
  if (level) merWbStatusEl.classList.add(level);
}

function resizeWbFftCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.floor(wbFftCanvas.clientWidth));
  const h = Math.max(1, Math.floor(wbFftCanvas.clientHeight));
  const tw = Math.floor(w * dpr);
  const th = Math.floor(h * dpr);
  if (wbFftCanvas.width !== tw || wbFftCanvas.height !== th) {
    wbFftCanvas.width = tw;
    wbFftCanvas.height = th;
  }
  wbFftCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wbFftReady = true;
}

async function toggleFullscreenFor(element) {
  const mustUsePseudo = isIOSLike() || !document.fullscreenEnabled || !element.requestFullscreen;

  if (mustUsePseudo) {
    if (pseudoFullscreenEl === element) exitPseudoFullscreen();
    else enterPseudoFullscreen(element);
    resizeChartCanvas();
    if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
    return;
  }

  try {
    if (document.fullscreenElement === element) {
      await document.exitFullscreen();
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    await element.requestFullscreen();

    // Some Safari/iOS builds expose API but do not actually enter fullscreen.
    setTimeout(() => {
      if (document.fullscreenElement !== element) {
        enterPseudoFullscreen(element);
        resizeChartCanvas();
        if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
      }
    }, 120);
  } catch {
    enterPseudoFullscreen(element);
    resizeChartCanvas();
    if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
    addDebug("fullscreen fallback active");
  }
}

function drawWbFft(fftData) {
  if (!wbFftReady || !fftData || !fftData.length) return;
  const w = wbFftCanvas.clientWidth;
  const h = wbFftCanvas.clientHeight;
  wbFftCtx.clearRect(0, 0, w, h);

  wbFftCtx.fillStyle = "#000000";
  wbFftCtx.fillRect(0, 0, w, h);

  // BATC-like dotted grid
  wbFftCtx.strokeStyle = "#3c4854";
  wbFftCtx.lineWidth = 1;
  wbFftCtx.setLineDash([3, 6]);
  for (let i = 1; i <= 4; i++) {
    const y = (h * i) / 5;
    wbFftCtx.beginPath();
    wbFftCtx.moveTo(0, y);
    wbFftCtx.lineTo(w, y);
    wbFftCtx.stroke();
  }
  for (let i = 1; i <= 8; i++) {
    const x = (w * i) / 9;
    wbFftCtx.beginPath();
    wbFftCtx.moveTo(x, 0);
    wbFftCtx.lineTo(x, h);
    wbFftCtx.stroke();
  }
  wbFftCtx.setLineDash([]);

  // Frequency labels (IF MHz across 490.5 to 499.5)
  wbFftCtx.fillStyle = "#7fb0c9";
  wbFftCtx.font = "11px Trebuchet MS";
  wbFftCtx.textAlign = "center";
  for (let i = 0; i <= 9; i++) {
    const x = (w * i) / 9;
    wbFftCtx.fillText((490.5 + i).toFixed(1), x, h - 6);
  }

  // Beacon marker at 10,491.5 = 491.5 relative to 490.5-499.5 span
  const beaconX = ((491.5 - 490.5) / 9.0) * w;
  wbFftCtx.strokeStyle = "#9aa8b3";
  wbFftCtx.setLineDash([6, 6]);
  wbFftCtx.beginPath();
  wbFftCtx.moveTo(beaconX, 0);
  wbFftCtx.lineTo(beaconX, h);
  wbFftCtx.stroke();
  wbFftCtx.setLineDash([]);

  // Build trace
  const len = fftData.length;
  const trace = new Array(w);
  for (let x = 0; x < w; x++) {
    const idx = Math.min(len - 1, Math.floor((x / Math.max(1, w - 1)) * len));
    const sample = fftData[idx] / 65535;
    const y = h - Math.min(1, sample) * h;
    trace[x] = y;
  }

  // Filled spectrum area (blue/purple)
  const grad = wbFftCtx.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0.0, "#49a8ea");
  grad.addColorStop(0.45, "#6ea2db");
  grad.addColorStop(1.0, "#b285c6");
  wbFftCtx.fillStyle = grad;
  wbFftCtx.beginPath();
  wbFftCtx.moveTo(0, h);
  for (let x = 0; x < w; x++) {
    wbFftCtx.lineTo(x, trace[x]);
  }
  wbFftCtx.lineTo(w - 1, h);
  wbFftCtx.closePath();
  wbFftCtx.fill();

  // Top outline
  wbFftCtx.strokeStyle = "#8cc5f3";
  wbFftCtx.lineWidth = 1.2;
  wbFftCtx.beginPath();
  for (let x = 0; x < w; x++) {
    if (x === 0) wbFftCtx.moveTo(x, trace[x]);
    else wbFftCtx.lineTo(x, trace[x]);
  }
  wbFftCtx.stroke();

}

function updateChartLegend() {
  const targetText = activeExpectedRange
    ? `${((activeExpectedRange.min + activeExpectedRange.max) / 2).toFixed(1)} dB target`
    : "No target";
  chartLegendEl.innerHTML = `<span class="legend-item"><span class="legend-swatch"></span>MER</span><span class="legend-item"><span class="legend-swatch target"></span>${targetText}</span>`;
}

function alignSymbolrate(width) {
  if (width < 0.022) return 0;
  if (width < 0.060) return 0.035;
  if (width < 0.086) return 0.066;
  if (width < 0.185) return 0.125;
  if (width < 0.277) return 0.25;
  if (width < 0.388) return 0.333;
  if (width < 0.700) return 0.5;
  if (width < 1.2) return 1.0;
  if (width < 1.6) return 1.5;
  if (width < 2.2) return 2.0;
  return Math.round(width * 5) / 5.0;
}

function countBatcActiveSignals(fftData) {
  const signalThreshold = 16000;
  const noiseLevel = 11000;
  let inSignal = false;
  let startSignal = 0;
  let count = 0;

  for (let i = 2; i < fftData.length; i++) {
    const avg3 = (fftData[i] + fftData[i - 1] + fftData[i - 2]) / 3.0;
    if (!inSignal && avg3 > signalThreshold) {
      inSignal = true;
      startSignal = i;
      continue;
    }
    if (inSignal && avg3 < signalThreshold) {
      inSignal = false;
      let endSignal = i;
      if (endSignal <= startSignal) continue;

      let acc = 0;
      let accCount = 0;
      const l = Math.floor(startSignal + 0.3 * (endSignal - startSignal));
      const r = Math.floor(startSignal + 0.7 * (endSignal - startSignal));
      for (let j = l; j < r; j++) {
        acc += fftData[j];
        accCount++;
      }
      const strength = accCount ? acc / accCount : noiseLevel;

      let s = startSignal;
      while (s < endSignal && (fftData[s] - noiseLevel) < 0.75 * (strength - noiseLevel)) s++;
      let e = endSignal;
      while (e > s && (fftData[e] - noiseLevel) < 0.75 * (strength - noiseLevel)) e--;
      if (e <= s) continue;

      const mid = s + (e - s) / 2.0;
      const bw = alignSymbolrate((e - s) * (9.0 / fftData.length));
      const signalFreq = 490.5 + (((mid + 1) / fftData.length) * 9.0);

      if (signalFreq < 492.0) continue; // ignore beacon region
      if (bw >= 0.125) count++;
    }
  }
  return count;
}

function closeBatcMonitor() {
  if (batcReconnectTimer) {
    clearTimeout(batcReconnectTimer);
    batcReconnectTimer = null;
  }
  if (batcWs) {
    try { batcWs.close(); } catch {}
    batcWs = null;
  }
}

function openBatcMonitor() {
  if (batcWs && (batcWs.readyState === WebSocket.OPEN || batcWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  closeBatcMonitor();
  setWbStatus("WB occupancy: checking...");
  batcWs = new WebSocket(BATC_WB_WS_URL, "fft");

  batcWs.onmessage = async (event) => {
    let buffer = null;
    if (event.data instanceof ArrayBuffer) {
      buffer = event.data;
    } else if (event.data instanceof Blob) {
      buffer = await event.data.arrayBuffer();
    }
    if (!buffer) return;

    const fftData = new Uint16Array(buffer);
    if (!fftData.length) return;
    drawWbFft(fftData);
    const active = countBatcActiveSignals(fftData);
    if (active === 0) {
      setWbStatus("WB occupancy: beacon only (transponder appears empty)", "ok");
    } else {
      setWbStatus(`Occupancy Warning: ${active} other signal(s) active`, "warn");
    }
  };

  batcWs.onerror = () => setWbStatus("WB occupancy: monitor unavailable");
  batcWs.onclose = () => {
    batcWs = null;
    setWbStatus("WB occupancy: reconnecting...");
    batcReconnectTimer = setTimeout(openBatcMonitor, 3000);
  };
}

function addDebug(line) {
  if (!debugMode) return;
  const ts = new Date().toLocaleTimeString();
  debugLogEl.textContent = `[${ts}] ${line}\n` + debugLogEl.textContent;
  debugLogEl.textContent = debugLogEl.textContent.split("\n").slice(0, 120).join("\n");
}

function formatRxLabel(r) {
  const rxId = Number(r.rx);
  const state = r.state ? String(r.state) : "";
  const service = r.service_name ? String(r.service_name) : "";
  const provider = r.service_provider_name ? String(r.service_provider_name) : "";
  const mer = Number(r.mer);
  const merText = Number.isFinite(mer) ? `${mer.toFixed(1)} dB` : "no MER";

  const parts = [`rx ${rxId}`];
  if (service) parts.push(service);
  if (!service && provider) parts.push(provider);
  if (state) parts.push(state);
  parts.push(merText);
  return parts.join(" | ");
}

function upsertRxOptions(rxArray) {
  rxArray.forEach((r) => {
    const rxNum = Number(r.rx);
    if (!Number.isFinite(rxNum) || rxNum <= 0) return;

    let opt = rxOptionMap.get(rxNum);
    if (!opt) {
      opt = document.createElement("option");
      opt.value = String(rxNum);
      rxOptionMap.set(rxNum, opt);
      rxSelectEl.appendChild(opt);
    }
    opt.textContent = formatRxLabel(r);
  });
}

function chooseRxWithMer(data) {
  upsertRxOptions(data.rx);

  const entries = data.rx
    .map((r) => ({ ...r, merNum: Number(r.mer), rxNum: Number(r.rx) }))
    .filter((r) => Number.isFinite(r.merNum) && r.rxNum > 0);

  if (!entries.length) return null;

  const selected = Number(rxSelectEl.value);
  if (selected >= 0) {
    const found = entries.find((r) => r.rxNum === selected);
    if (found) return { chosen: found, auto: false };
  }

  const best = entries.reduce((acc, r) => (acc.merNum >= r.merNum ? acc : r));
  return { chosen: best, auto: true };
}

function tryParseMessage(raw) {
  let data = raw;

  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      const n = Number(raw);
      if (Number.isFinite(n)) return { mer: n, source: "plain-number" };
      return { source: "text", raw };
    }
  }

  if (typeof data === "number") {
    return { mer: data, source: "number" };
  }

  if (!data || typeof data !== "object") {
    return { source: "unknown", raw };
  }

  if (Array.isArray(data.rx)) {
    const picked = chooseRxWithMer(data);
    if (picked) {
      const { chosen, auto } = picked;
      return {
        mer: chosen.merNum,
        source: auto ? `rx[${chosen.rx}].mer(auto)` : `rx[${chosen.rx}].mer`,
        rx: {
          frequency: chosen.frequency,
          demodState: chosen.state || chosen.scanstate,
          provider: chosen.service_provider_name,
          service: chosen.service_name
        }
      };
    }
  }

  if (data.packet && data.packet.rx && Number.isFinite(Number(data.packet.rx.mer))) {
    return {
      mer: Number(data.packet.rx.mer) / 10,
      source: "packet.rx.mer/10",
      rx: {
        frequency: data.packet.rx.frequency,
        demodState: data.packet.rx.demod_state,
        provider: data.packet.rx.provider,
        service: data.packet.rx.service
      }
    };
  }

  return { source: "no-mer-field", parsed: data };
}

function updateMer(mer, source, rx = null) {
  merPoints.push({ t: Date.now(), mer });
  if (merPoints.length > maxPoints) merPoints = merPoints.slice(-maxPoints);

  merValueEl.textContent = mer.toFixed(2);
  if (trendMerEl) trendMerEl.textContent = `MER: ${mer.toFixed(2)} dB`;
  let trend = "stable";
  if (lastMer !== null) {
    if (mer > lastMer + 0.05) trend = "up";
    else if (mer < lastMer - 0.05) trend = "down";
  }
  lastMer = mer;

  merMetaEl.textContent = `Source: ${source} | Trend: ${trend}`;
  merMetaEl.style.color = trend === "up" ? "#1f9f57" : trend === "down" ? "#bf2f4a" : "#334";

  if (rx) {
    const demodLabel = DEMOD_MAP[rx.demodState] ?? String(rx.demodState ?? "-");
    const freq = rx.frequency ? `${rx.frequency} MHz` : "-";
    const service = rx.service || "";
    rxMetaEl.textContent = `Demod: ${demodLabel} | Freq: ${freq} ${service ? `| Service: ${service}` : ""}`;
  }

  fitMerValueToWidth();
  drawChart();
  updateTone(mer);
}

function applyDishPreset() {
  const preset = DISH_MER_PRESETS[dishSizeSelectEl.value];
  if (!preset) {
    activeExpectedRange = null;
    merMetaEl.textContent = `${merMetaEl.textContent.split(" | Expected MER")[0] || merMetaEl.textContent}`;
    updateChartLegend();
    drawChart();
    return;
  }

  activeExpectedRange = { min: preset.min, max: preset.max };
  toneMinMerEl.value = String(preset.min);
  toneMaxMerEl.value = String(preset.max);
  const current = merMetaEl.textContent || "";
  const base = current.split(" | Expected MER")[0];
  merMetaEl.textContent = `${base} | Expected MER: ${preset.min.toFixed(1)}-${preset.max.toFixed(1)} dB`;
  updateChartLegend();
  drawChart();
}

function drawChart() {
  if (!canvasReady) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  if (!merPoints.length) {
    ctx.fillStyle = "#678";
    ctx.font = "20px Trebuchet MS";
    ctx.fillText("Waiting for MER data...", 20, h / 2);
    return;
  }

  const values = merPoints.map((p) => p.mer);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1) {
    min -= 0.5;
    max += 0.5;
  }

  const pad = 28;
  const xFor = (i) => pad + (i / Math.max(1, merPoints.length - 1)) * (w - pad * 2);
  const yFor = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);

  ctx.strokeStyle = "#d4e3ea";
  for (let i = 0; i < 5; i++) {
    const y = pad + (i / 4) * (h - pad * 2);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#0e8f82";
  ctx.lineWidth = 3;
  ctx.beginPath();
  merPoints.forEach((p, i) => {
    const x = xFor(i);
    const y = yFor(p.mer);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  if (activeExpectedRange) {
    const target = (activeExpectedRange.min + activeExpectedRange.max) / 2;
    const clampedTarget = Math.max(min, Math.min(max, target));
    const y = yFor(clampedTarget);
    ctx.strokeStyle = "#a86f00";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

}

function resizeChartCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.max(1, Math.floor(canvas.clientWidth));
  const displayHeight = Math.max(1, Math.floor(canvas.clientHeight));
  const targetWidth = Math.floor(displayWidth * dpr);
  const targetHeight = Math.floor(displayHeight * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvasReady = true;
  scheduleMerRefitBurst();
  drawChart();
}

function ensureTone() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 300;
    gainNode.gain.value = 0;
    oscillator.connect(gainNode).connect(audioCtx.destination);
    oscillator.start();
  }
}

function updateTone(mer) {
  if (!toneEnabledEl.checked) {
    if (gainNode && audioCtx) gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.03);
    return;
  }

  ensureTone();
  if (audioCtx.state === "suspended") audioCtx.resume();

  const minMer = Number(toneMinMerEl.value);
  const maxMer = Number(toneMaxMerEl.value);
  const span = Math.max(0.1, maxMer - minMer);
  const normalized = Math.max(0, Math.min(1, (mer - minMer) / span));

  const freq = 220 + normalized * 980;
  oscillator.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.05);
  gainNode.gain.setTargetAtTime(0.04, audioCtx.currentTime, 0.03);
}

function stopTone() {
  if (gainNode && audioCtx) {
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02);
  }
}

function connect() {
  const ip = wsIpInput.value.trim();
  const port = wsPortInput.value.trim() || "8080";
  if (!ip) return;
  const url = `ws://${ip}:${port}`;

  if (ws && ws.readyState === WebSocket.OPEN) ws.close();
  setStatus("Connecting...");
  ws = new WebSocket(url, "monitor");

  ws.onopen = () => {
    setStatus("Connected", true);
    setUiConnected(true);
    addDebug(`connected to ${url} (protocol: monitor)`);
  };

  ws.onclose = () => {
    setStatus("Disconnected");
    setUiConnected(false);
    stopTone();
    addDebug("socket closed");
  };

  ws.onerror = () => {
    setStatus("Socket error");
    setUiConnected(false);
    stopTone();
    addDebug("socket error");
  };

  ws.onmessage = async (event) => {
    let raw = event.data;
    if (raw instanceof Blob) raw = await raw.text();
    else if (raw instanceof ArrayBuffer) raw = new TextDecoder().decode(raw);

    const parsed = tryParseMessage(raw);
    if (Number.isFinite(parsed.mer)) {
      updateMer(parsed.mer, parsed.source, parsed.rx || null);
    } else {
      addDebug(`unparsed: ${typeof raw === "string" ? raw : JSON.stringify(raw)}`);
    }
  };
}

connectBtn.addEventListener("click", connect);
disconnectBtn.addEventListener("click", () => ws && ws.close());
clearChartBtn.addEventListener("click", () => {
  merPoints = [];
  drawChart();
});

dishSizeSelectEl.addEventListener("change", applyDishPreset);

setStatus("Disconnected");
setUiConnected(false);
setWbStatus("WB occupancy: checking...");
disableIOSZoomGestures();
updateDynamicViewportHeightVar();
scheduleMerRefitBurst();
resizeChartCanvas();
applyDishPreset();
updateChartLegend();
window.addEventListener("resize", resizeChartCanvas);
window.addEventListener("resize", updateDynamicViewportHeightVar);
window.addEventListener("orientationchange", scheduleMerRefitBurst);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateDynamicViewportHeightVar);
  window.visualViewport.addEventListener("resize", scheduleMerRefitBurst);
}
if (!debugMode && debugPanelEl) {
  debugPanelEl.style.display = "none";
}

wbStatusEl.title = "Open BATC Wideband Spectrum";
wbStatusEl.style.cursor = "pointer";
wbStatusEl.addEventListener("click", () => {
  wbFftWrapEl.toggleAttribute("hidden");
  if (!wbFftWrapEl.hasAttribute("hidden")) {
    resizeWbFftCanvas();
  }
});
window.addEventListener("resize", () => {
  if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
});
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    exitPseudoFullscreen();
    globalExitFsBtn.hidden = false;
  } else if (!pseudoFullscreenEl) {
    globalExitFsBtn.hidden = true;
  }
  resizeChartCanvas();
  scheduleMerRefitBurst();
  if (!wbFftWrapEl.hasAttribute("hidden")) resizeWbFftCanvas();
});

function bindFullscreenButton(buttonEl, openFn) {
  let suppressClickUntil = 0;
  let lastTriggerAt = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let movedDuringTouch = false;
  const moveThresholdPx = 10;
  const trigger = () => {
    const now = Date.now();
    if (now - lastTriggerAt < 350) return;
    lastTriggerAt = now;
    suppressClickUntil = now + 700;
    openFn();
  };

  buttonEl.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch") return;
    if (movedDuringTouch) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    trigger();
  });

  buttonEl.addEventListener("touchstart", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    movedDuringTouch = false;
  }, { passive: true });

  buttonEl.addEventListener("touchmove", (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    if (
      Math.abs(t.clientX - touchStartX) > moveThresholdPx ||
      Math.abs(t.clientY - touchStartY) > moveThresholdPx
    ) {
      movedDuringTouch = true;
    }
  }, { passive: true });

  buttonEl.addEventListener("touchend", (e) => {
    if (movedDuringTouch) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    trigger();
  }, { passive: false });

  buttonEl.addEventListener("click", (e) => {
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      return;
    }
    openFn();
  });
}

bindFullscreenButton(merFullscreenBtn, () => toggleFullscreenFor(document.querySelector(".mer-panel")));
bindFullscreenButton(trendFullscreenBtn, () => toggleFullscreenFor(document.querySelector(".chart-panel")));
bindFullscreenButton(wbFullscreenBtn, () => {
  if (wbFftWrapEl.hasAttribute("hidden")) wbFftWrapEl.removeAttribute("hidden");
  resizeWbFftCanvas();
  toggleFullscreenFor(wbFftWrapEl);
});
globalExitFsBtn.addEventListener("click", () => {
  exitAnyFullscreen();
});
openBatcMonitor();
