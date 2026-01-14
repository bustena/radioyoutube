let player = null;
let apiReady = false;

const els = {
  form: document.getElementById("loadForm"),
  url: document.getElementById("ytUrl"),
  title: document.getElementById("title"),
  status: document.getElementById("status"),

  play: document.getElementById("playBtn"),
  pause: document.getElementById("pauseBtn"),
  stop: document.getElementById("stopBtn"),
  mute: document.getElementById("muteBtn"),
  volDown: document.getElementById("volDownBtn"),
  volUp: document.getElementById("volUpBtn"),
  volRange: document.getElementById("volRange"),
};

function setStatus(text) {
  els.status.textContent = text;
}

function setTitle(text) {
  els.title.textContent = text;
}

// Extrae ID de URL típica: watch?v=, youtu.be/, shorts/, embed/
function extractVideoId(input) {
  const s = (input || "").trim();
  if (!s) return null;

  // Si ya parece un ID (11 chars típicos), lo aceptamos
  // (YouTube IDs suelen ser 11, pero no lo forzamos al 100%)
  if (/^[a-zA-Z0-9_-]{8,15}$/.test(s) && !s.includes("http")) return s;

  try {
    const url = new URL(s);
    const host = url.hostname.replace("www.", "");

    if (host === "youtu.be") {
      return url.pathname.slice(1) || null;
    }

    if (host.includes("youtube.com")) {
      // watch?v=
      const v = url.searchParams.get("v");
      if (v) return v;

      // /shorts/ID
      const mShorts = url.pathname.match(/\/shorts\/([^/?]+)/);
      if (mShorts) return mShorts[1];

      // /embed/ID
      const mEmbed = url.pathname.match(/\/embed\/([^/?]+)/);
      if (mEmbed) return mEmbed[1];
    }
  } catch {
    // no es URL válida: cae fuera
  }

  return null;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function setVolume(v) {
  if (!player) return;
  const vol = clamp(Math.round(v), 0, 100);
  player.setVolume(vol);
  els.volRange.value = String(vol);
}

function getNiceState(state) {
  // https://developers.google.com/youtube/iframe_api_reference#Playback_status
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

function initPlayer(videoId) {
  // Si ya existe, lo destruimos y recreamos (más simple para la prueba)
  if (player) {
    player.destroy();
    player = null;
  }

  setTitle("Cargando…");
  setStatus("Inicializando reproductor…");

  player = new YT.Player("player", {
    height: "200",
    width: "100%",
    videoId,
    playerVars: {
      // “lo mínimo” en UI de YouTube
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      // Ojo: autoplay puede estar bloqueado; arrancamos con interacción del usuario.
      autoplay: 0,
    },
    events: {
      onReady: () => {
        setStatus("Listo. Pulsa ▶︎");
        // Volumen inicial
        setVolume(Number(els.volRange.value));
        // Intenta obtener título (no siempre disponible inmediatamente)
        const data = player.getVideoData?.();
        if (data?.title) setTitle(data.title);
        else setTitle("YouTube");
      },
      onStateChange: (e) => {
        setStatus(getNiceState(e.data));
        const data = player.getVideoData?.();
        if (data?.title) setTitle(data.title);
      },
      onError: () => {
        setTitle("Error");
        setStatus("No se pudo cargar el vídeo (ID inválido o restringido).");
      }
    }
  });
}

// YouTube llama a esta función global cuando la API está lista
window.onYouTubeIframeAPIReady = () => {
  apiReady = true;
  setStatus("API lista. Pega una URL y pulsa “Cargar”.");
};

els.form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const id = extractVideoId(els.url.value);
  if (!id) {
    setTitle("Sin cargar");
    setStatus("No reconozco esa URL/ID. Prueba con un enlace de YouTube válido.");
    return;
  }
  if (!apiReady) {
    setStatus("La API aún no está lista. Reintenta en un momento.");
    return;
  }
  initPlayer(id);
});

els.play.addEventListener("click", () => {
  if (!player) return;
  player.playVideo();
});

els.pause.addEventListener("click", () => {
  if (!player) return;
  player.pauseVideo();
});

els.stop.addEventListener("click", () => {
  if (!player) return;
  player.stopVideo();
  setStatus("Detenido");
});

els.mute.addEventListener("click", () => {
  if (!player) return;
  if (player.isMuted()) {
    player.unMute();
    setStatus("Sonando");
  } else {
    player.mute();
    setStatus("Silenciado");
  }
});

els.volDown.addEventListener("click", () => {
  if (!player) return;
  setVolume(player.getVolume() - 5);
});

els.volUp.addEventListener("click", () => {
  if (!player) return;
  setVolume(player.getVolume() + 5);
});

els.volRange.addEventListener("input", (e) => {
  setVolume(Number(e.target.value));
});

// Estado inicial
setTitle("Sin cargar");
setStatus("Cargando API de YouTube…");
