/*
  Blue Summer Rain
  Persistent music player + iframe page navigation

  그대로 유지:
    루트 index.html       -> <script src="./common.js"></script>
    하위 폴더 index.html -> <script src="../common.js"></script>

  핵심:
  - 메인 페이지의 <audio>는 절대 없어지지 않음.
  - 메뉴를 누르면 하위 index.html만 iframe 안에서 교체됨.
  - iframe 안의 중복 음악 플레이어는 숨김.
  - 하위 페이지의 HOME / BACK TO MAIN은 iframe을 닫고 메인으로 복귀.
*/

const TRACKS = [
  {
    title: "Dive with You - Seori",
    url: "https://raw.githubusercontent.com/PMC314159/Music/main/dive-with-you.mp3"
  },
  {
    title: "But You! - The Whales",
    url: "https://raw.githubusercontent.com/PMC314159/Music/main/but-you.mp3"
  },
  {
    title: "You Better Know - Red Velvet",
    url: "https://raw.githubusercontent.com/PMC314159/Music/main/you-better-know.mp3"
  }
];

const STORAGE_KEY = "blue-summer-rain-player";
const IS_IFRAME = window.self !== window.top;

const bgm = document.getElementById("bgm");
const musicBtn = document.getElementById("music-btn");
const musicTitle = document.getElementById("music-title");
const musicPlayer = document.getElementById("music-player");

let currentTrack = 0;
let pendingTime = 0;
let saveTimer = null;


/* =========================================================
   iframe 안에서 실행될 때
   ========================================================= */

if (IS_IFRAME) {
  // 메인 페이지의 플레이어만 사용하므로 하위 페이지 플레이어는 숨김.
  if (musicPlayer) {
    musicPlayer.style.display = "none";
  }

  // 혹시라도 하위 페이지 audio가 로드돼 있으면 확실히 정지.
  if (bgm) {
    try {
      bgm.pause();
      bgm.removeAttribute("src");
      bgm.load();
    } catch (_) {}
  }

  // HOME / BACK TO MAIN 클릭 시 iframe 자체가 메인으로 이동하지 않고
  // 바깥 메인 페이지에게 "창 닫아줘"라고 전달.
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");
    if (!anchor) return;

    const text = (anchor.textContent || "").trim().toUpperCase();
    const isBackButton =
      anchor.classList.contains("back") ||
      text.includes("BACK TO MAIN") ||
      text === "← HOME" ||
      text === "HOME";

    if (!isBackButton) return;

    event.preventDefault();
    window.parent.postMessage(
      { type: "blue-summer-rain-close-page" },
      window.location.origin
    );
  });

  // iframe 안에서는 아래의 메인 음악/라우터 초기화를 하지 않음.
}


/* =========================================================
   메인 창에서만 음악 플레이어 초기화
   ========================================================= */

function readPlayerState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function savePlayerState() {
  if (!bgm || IS_IFRAME) return;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      track: currentTrack,
      time: Number.isFinite(bgm.currentTime) ? bgm.currentTime : 0,
      playing: !bgm.paused
    })
  );
}

function setPlayIcon(isPlaying) {
  if (!musicBtn) return;
  musicBtn.textContent = isPlaying ? "Ⅱ" : "▶";
}

function loadTrack(index, resumeTime = 0) {
  if (!bgm || !TRACKS.length || IS_IFRAME) return;

  currentTrack = (index + TRACKS.length) % TRACKS.length;
  const track = TRACKS[currentTrack];

  bgm.src = track.url;
  if (musicTitle) musicTitle.textContent = track.title;

  pendingTime = Math.max(0, resumeTime || 0);
  bgm.load();
}

async function playCurrentTrack() {
  if (!bgm || IS_IFRAME) return;

  try {
    await bgm.play();
    setPlayIcon(true);
  } catch (error) {
    console.warn("Audio playback was blocked or failed:", error);
    setPlayIcon(false);
  }
}

async function toggleMusic() {
  if (!bgm || IS_IFRAME) return;

  if (bgm.paused) {
    await playCurrentTrack();
  } else {
    bgm.pause();
    setPlayIcon(false);
  }

  savePlayerState();
}

function changeTrack(direction) {
  if (!TRACKS.length || !bgm || IS_IFRAME) return;

  const wasPlaying = !bgm.paused;
  loadTrack(currentTrack + direction, 0);

  if (wasPlaying) {
    playCurrentTrack();
  } else {
    setPlayIcon(false);
  }

  savePlayerState();
}

function prevTrack() {
  changeTrack(-1);
}

function nextTrack() {
  changeTrack(1);
}

function playNextTrackAutomatically() {
  if (!TRACKS.length || !bgm || IS_IFRAME) return;

  loadTrack(currentTrack + 1, 0);
  playCurrentTrack();
  savePlayerState();
}

if (!IS_IFRAME && bgm) {
  const saved = readPlayerState();
  const savedTrack = Number.isInteger(saved.track) ? saved.track : 0;
  const savedTime = typeof saved.time === "number" ? saved.time : 0;

  loadTrack(savedTrack, savedTime);

  bgm.addEventListener("loadedmetadata", () => {
    if (pendingTime > 0 && Number.isFinite(bgm.duration)) {
      bgm.currentTime = Math.min(
        pendingTime,
        Math.max(0, bgm.duration - 0.25)
      );
      pendingTime = 0;
    }
  });

  bgm.addEventListener("play", () => {
    setPlayIcon(true);
    savePlayerState();
  });

  bgm.addEventListener("pause", () => {
    setPlayIcon(false);
    savePlayerState();
  });

  bgm.addEventListener("ended", playNextTrackAutomatically);

  bgm.addEventListener("timeupdate", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePlayerState, 400);
  });

  window.addEventListener("pagehide", savePlayerState);
  window.addEventListener("beforeunload", savePlayerState);

  setPlayIcon(false);
}

window.toggleMusic = toggleMusic;
window.prevTrack = prevTrack;
window.nextTrack = nextTrack;


/* =========================================================
   메인 창: iframe 라우터
   ========================================================= */

if (!IS_IFRAME) {
  const ROUTES = new Set([
    "romance",
    "tendency",
    "personnel",
    "timeline",
    "commission",
    "fragments"
  ]);

  const currentScript =
    document.currentScript ||
    [...document.scripts]
      .reverse()
      .find((script) => /(?:^|\/)common\.js(?:\?|#|$)/.test(script.src));

  const siteBase = currentScript
    ? new URL("./", currentScript.src)
    : new URL("./", window.location.href);

  let frameLayer = null;
  let contentFrame = null;
  let activeRoute = null;
  let previousBodyOverflow = "";

  function routeFromUrl(url) {
    if (url.origin !== window.location.origin) return null;
    if (!url.pathname.startsWith(siteBase.pathname)) return null;

    const relative = url.pathname.slice(siteBase.pathname.length);
    const match = relative.match(
      /^(romance|tendency|personnel|timeline|commission|fragments)(?:\/(?:index\.html)?)?$/
    );

    return match ? match[1] : null;
  }

  function ensureFrame() {
    if (frameLayer && contentFrame) return;

    frameLayer = document.createElement("div");
    frameLayer.id = "bsr-page-layer";
    frameLayer.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:40",
      "display:none",
      "background:#eef2e9",
      "overflow:hidden"
    ].join(";");

    contentFrame = document.createElement("iframe");
    contentFrame.id = "bsr-content-frame";
    contentFrame.title = "Blue Summer Rain content";
    contentFrame.setAttribute("loading", "eager");
    contentFrame.style.cssText = [
      "display:block",
      "width:100%",
      "height:100%",
      "border:0",
      "margin:0",
      "padding:0",
      "background:transparent"
    ].join(";");

    frameLayer.appendChild(contentFrame);

    // 음악 플레이어보다 아래, 메인 화면보다는 위.
    if (musicPlayer) {
      musicPlayer.before(frameLayer);
      musicPlayer.style.zIndex = "100";
    } else {
      document.body.appendChild(frameLayer);
    }
  }

  function routeUrl(route) {
    return new URL(`${route}/index.html`, siteBase);
  }

  function showRoute(route, pushHistory = true) {
    if (!ROUTES.has(route)) return;

    ensureFrame();

    activeRoute = route;
    contentFrame.src = routeUrl(route).href;
    frameLayer.style.display = "block";

    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (pushHistory) {
      history.pushState(
        { blueSummerRainRoute: route },
        "",
        `#${route}`
      );
    }
  }

  function hideRoute(pushHistory = false) {
    if (!frameLayer) return;

    activeRoute = null;
    frameLayer.style.display = "none";
    contentFrame.src = "about:blank";
    document.body.style.overflow = previousBodyOverflow;

    if (pushHistory) {
      history.pushState(
        { blueSummerRainRoute: null },
        "",
        `${siteBase.pathname}`
      );
    }
  }

  // 메인 화면의 카드 클릭 가로채기.
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");
    if (!anchor) return;

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      anchor.hasAttribute("download")
    ) {
      return;
    }

    const target = (anchor.getAttribute("target") || "").toLowerCase();
    if (target && target !== "_self") return;

    let url;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch (_) {
      return;
    }

    const route = routeFromUrl(url);
    if (!route) return;

    event.preventDefault();
    showRoute(route, true);
  });

  // iframe 안의 HOME / BACK TO MAIN이 보내는 신호.
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (!contentFrame || event.source !== contentFrame.contentWindow) return;

    if (event.data?.type === "blue-summer-rain-close-page") {
      if (history.state?.blueSummerRainRoute) {
        history.back();
      } else {
        hideRoute(false);
      }
    }
  });

  // 브라우저 뒤로/앞으로 버튼 대응.
  window.addEventListener("popstate", (event) => {
    const route =
      event.state?.blueSummerRainRoute ||
      window.location.hash.replace(/^#/, "");

    if (ROUTES.has(route)) {
      showRoute(route, false);
    } else {
      hideRoute(false);
    }
  });

  // 새로고침 후 #tendency 같은 주소가 남아 있을 때도 복구.
  const initialRoute = window.location.hash.replace(/^#/, "");
  if (ROUTES.has(initialRoute)) {
    history.replaceState(
      { blueSummerRainRoute: initialRoute },
      "",
      window.location.href
    );
    showRoute(initialRoute, false);
  } else {
    history.replaceState(
      { blueSummerRainRoute: null },
      "",
      window.location.href
    );
  }
}
