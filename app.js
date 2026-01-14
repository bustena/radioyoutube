// === Config ===
const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSf6BYaaI6zMCwa7woUt68NZogJHGbb1-8ivvaMqCr3Km8WUDbGXXhZ6GMCh_wbd4ul3fZCi1bXaJ3z/pub?gid=0&single=true&output=csv";

// === State ===
let player = null;
let apiReady = false;
let presets = []; // { label, url, videoId }
let activeIndex = -1;

// === Elements ===
const els = {
  tabs: document.getElementById("tabs"),
  title: document.getElementById("title"),
  status: document.getElementById("status"),
  footnote: document.getElementById("footnote"),

  play: document.getElementById("playBtn"),
  pause: document.getElementById("pauseBtn"),
  stop: document.getElementById("stopBtn"),
  mute: document.getElementById("muteBtn"),
  volDown: document.getElementById("volDownBtn"),
  volUp: document.getElementById("volUpBtn"),
  volRange: document.getElementById("volRange"),
};

function setStatus(text) { els.status.textContent = text; }
function setTitle(text) { els.title.textContent = text; }
function setFoot(text) { els.footnote.textContent = text; }

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

// Extrae ID de URL típica: watch?v=, youtu.be/, shorts/, embed/
function extractVideoId(input) {
  const s = (input || "").trim();
  if (!s) return null;

  // Si ya parece un ID, lo aceptamos
  if (/^[a-zA-Z0-9_-]{8,15}$/.test(s) && !s.includes("http")) return s;

  try {
    const url = new URL(s);
    const host = url.hostname.replace("www.", "");

    if (host === "youtu.be") return url.pathname.slice(1) || null;

    if (host.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;

      const mShorts = url.pathname.match(/\/shorts\/([^/?]+)/);
      if (mShorts) return mShorts[1];

      const mEmbed = url.pathname.match(/\/embed\/([^/?]+)/);
      if (mEmbed) return mEmbed[1];
    }
  } catch {
    // ignore
  }

  return null;
}

// CSV simple (2 columnas). Soporta comillas básicas.
function parseCSV(text) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = splitCSVLine(lines[0]).map(s => s.trim().toLowerCase());
  const iEtiqueta = header.findIndex(h => h === "etiqueta");
  const iEnlace = header.findIndex(h => h === "enlace");

  if (iEtiqueta === -1 || iEnlace === -1) return [];

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const label = (cols[iEtiqueta] || "").trim();
    const url = (cols[iEnlace] || "").trim();
    if (!label || !url) continue;
    rows.push({ label, url, videoId: extractVideoId(url) });
  }
  return rows;
}

function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // doble comilla escapada
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function getNiceState(state) {
  switch (state) {
    case YT.PlayerState.UNSTARTED: return "Sin iniciar";
    case YT.PlayerState.ENDED: return "Finalizado";
    case YT.PlayerState.PLAYING: return "Reproduciendo";
    case YT.PlayerState.PAUSED: return "Pausado";
    case YT.PlayerState.BUFFERING: return "Cargando…";
    case YT.PlayerState.CUED: return "Listo";
    default: return "Estado desconocido";
  }
}

function setVolume(v) {
  if (!player) return;
  const vol = clamp(Math.round(v), 0, 100);
  player.setVolume(vol);
  els.volRange.value = String(vol);
}

function renderTabs() {
  els.tabs.innerHTML = "";

  presets.slice(0, 3).forEach((p, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab" + (idx === activeIndex ? " active" : "");
    btn.textContent = p.label;
    btn.addEventListener("click", () => selectPreset(idx, true));
    els.tabs.appendChild(btn);
  });
}

function markActiveTab() {
  const children = Array.from(els.tabs.children);
  children.forEach((el, idx) => {
    el.classList.toggle("active", idx === activeIndex);
  });
}

function ensurePlayerWithFirstVideo(videoId) {
  if (player) return;

  player = new YT.Player("player", {
    height: "200",
    width: "100%",
    videoId,
    playerVars: {
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      autoplay: 0,
    },
    events: {
      onReady: () => {
        setStatus("Listo. Pulsa ▶︎");
        setVolume(Number(els.volRange.value));
        const data = player.getVideoData?.();
        if (data?.title) setTitle(data.title);
      },
      onStateChange: (e) => {
        setStatus(getNiceState(e.data));
        const data = player.getVideoData?.();
        if (data?.title) setTitle(data.title);
      },
      onError: () => {
        setTitle("Error");
        setStatus("No se pudo cargar el vídeo (ID inválido o restringido).");
      },
    }
  });
}

function selectPreset(idx, autoplay = false) {
  if (idx < 0 || idx >= presets.length) return;

  const p = presets[idx];
  if (!p.videoId) {
    setTitle(p.label);
    setStatus("Enlace inválido (no puedo extraer ID).");
    return;
  }

  activeIndex = idx;
  markActiveTab();

  setTitle(p.label);
  setStatus("Cargando…");

  // Crea player si no existe aún
  ensurePlayerWithFirstVideo(p.videoId);

  // Si el player ya existía, cambiamos de vídeo
  if (player && typeof player.loadVideoById === "function") {
    if (autoplay) player.loadVideoById(p.videoId);
    else player.cueVideoById(p.videoId);
  }

  // actualiza pie
  setFoot(`Preset activo: ${p.label}`);
}

// === Bootstrap ===

async function loadPresets() {
  setTitle("Cargando…");
  setStatus("Leyendo Google Sheets…");
  setFoot("Cargando presets desde Google Sheets…");

  const res = await fetch(CSV_URL,_
