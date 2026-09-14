/*
  Blue Summer Rain - shared music player

  루트 index.html: <script src="common.js"></script>
  하위 폴더 index.html: <script src="../common.js"></script>

  현재 곡과 재생 위치는 localStorage에 저장됩니다.
  새 페이지에서 자동 재생은 브라우저 정책상 차단될 수 있습니다.
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

const bgm = document.getElementById("bgm");
const musicBtn = document.getElementById("music-btn");
const musicTitle = document.getElementById("music-title");

let currentTrack = 0;
let pendingTime = 0;
let saveTimer = null;

function readPlayerState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (_) {
    return {};
  }
}

function savePlayerState() {
  if (!bgm) return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    track: currentTrack,
    time: Number.isFinite(bgm.currentTime) ? bgm.currentTime : 0,
    playing: !bgm.paused
  }));
}

function setPlayIcon(isPlaying) {
  if (!musicBtn) return;
  musicBtn.textContent = isPlaying ? "Ⅱ" : "▶";
}

function loadTrack(index, resumeTime = 0) {
  if (!bgm || !TRACKS.length) return;

  currentTrack = (index + TRACKS.length) % TRACKS.length;
  const track = TRACKS[currentTrack];

  bgm.src = track.url;
  if (musicTitle) musicTitle.textContent = track.title;

  pendingTime = Math.max(0, resumeTime || 0);
  bgm.load();
}

async function playCurrentTrack() {
  if (!bgm) return;

  try {
    await bgm.play();
    setPlayIcon(true);
  } catch (error) {
    console.warn("Audio playback was blocked or failed:", error);
    setPlayIcon(false);
  }
}

async function toggleMusic() {
  if (!bgm) return;

  if (bgm.paused) {
    await playCurrentTrack();
  } else {
    bgm.pause();
    setPlayIcon(false);
  }

  savePlayerState();
}

function changeTrack(direction) {
  if (!TRACKS.length || !bgm) return;

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
  if (!TRACKS.length || !bgm) return;

  loadTrack(currentTrack + 1, 0);
  playCurrentTrack();
  savePlayerState();
}

if (bgm) {
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
