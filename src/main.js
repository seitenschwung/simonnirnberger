import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import '@fontsource/rock-salt';
import '@fontsource/figtree/400.css';
import './style.css';

import { CONFIG, DEFAULTS } from './config.js';
import { createScene, QUALITY_LEVELS } from './scene.js';
import { createEyes } from './eyes.js';
import { createFallback } from './fallback.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
const root = document.documentElement;

// ---------------------------------------------------------------------------
// Blob: WebGL if possible, otherwise the static SVG blob from index.html
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const fallback = createFallback(document.querySelector('.fallback'));

let scene = null;
try {
  scene = createScene(canvas, CONFIG, {
    reducedMotion,
    level: CONFIG.quality.auto ? (isMobile ? 2 : 0) : CONFIG.quality.level,
  });
} catch (error) {
  console.warn('WebGL ist nicht verfügbar, es bleibt beim statischen Blob.', error);
}

// The fallback stays visible until the first frame is drawn, and comes back
// if the GPU drops the context (and leaves again once it is restored).
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  root.classList.remove('webgl-ready');
});
canvas.addEventListener('webglcontextrestored', () => root.classList.add('webgl-ready'));

const blobScreen = scene ? scene.blobScreen : fallback.blobScreen;

// ---------------------------------------------------------------------------
// Colours: paper and ink drive the canvas and the CSS text colours
// ---------------------------------------------------------------------------
// Name and labels use mix-blend-mode: difference, so what shows on paper is
// |paper - colour|. To make the name show as ink and the labels as a soft grey,
// their CSS colours are paper minus the wanted colour.
function srgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function cssColor({ r, g, b }) {
  const c = (v) => Math.round(Math.min(Math.max(v, 0), 1) * 255);
  return `rgb(${c(r)} ${c(g)} ${c(b)})`;
}

function applyColors() {
  const paper = srgb(CONFIG.paper);
  const ink = srgb(CONFIG.ink);
  const mix = (a, b, t) => a + (b - a) * t;
  const grey = { r: mix(ink.r, paper.r, 0.3), g: mix(ink.g, paper.g, 0.3), b: mix(ink.b, paper.b, 0.3) };
  const minus = (a, b) => ({ r: Math.abs(a.r - b.r), g: Math.abs(a.g - b.g), b: Math.abs(a.b - b.b) });

  scene?.setColors(paper, CONFIG.ink);
  root.style.setProperty('--paper', cssColor(paper));
  root.style.setProperty('--ink', cssColor(ink));
  root.style.setProperty('--name', cssColor(minus(paper, ink)));
  root.style.setProperty('--muted', cssColor(minus(paper, grey)));
}

applyColors();
window.addEventListener('resize', () => scene?.resize());

// ---------------------------------------------------------------------------
// Scroll: blob grows and drifts to the centre, the name stays put
// ---------------------------------------------------------------------------
const scroll = { progress: 0 };

let lenis = null;
if (!reducedMotion) {
  // Low lerp = heavy, slow inertia.
  lenis = new Lenis({ lerp: CONFIG.scroll.lerp, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

const scrub = reducedMotion ? true : 1;
const scrollRange = { trigger: 'main', start: 'top top', end: 'bottom bottom', scrub };

gsap.to(scroll, { progress: 1, ease: 'none', scrollTrigger: scrollRange });
if (!scene) fallback.followScroll(scrollRange);

// Labels fade out early, the closing line fades in once the screen is ink.
gsap.to('.labels', {
  autoAlpha: 0,
  ease: 'none',
  scrollTrigger: { ...scrollRange, end: '15% top' },
});
gsap.to('.coda', {
  opacity: 1,
  ease: 'none',
  scrollTrigger: { ...scrollRange, start: '80% bottom' },
});

// "Zu den Werken": slow, heavy glide to the end instead of a jump.
document.querySelector('.link').addEventListener('click', (event) => {
  if (!lenis) return; // native anchor jump with reduced motion
  event.preventDefault();
  lenis.scrollTo('#werke', { duration: 3.5 });
});

// ---------------------------------------------------------------------------
// Eyes and energy jolts
// ---------------------------------------------------------------------------
const eyes = createEyes(CONFIG, { reducedMotion, blobScreen });

function jolt() {
  scene?.jolt();
  eyes.glance(); // a jolt makes the eyes glance at the blob
}

// Delays are re-read every time, so changes apply from the next spasm on.
function scheduleJolt() {
  const { minDelay, maxDelay } = CONFIG.jolt;
  gsap.delayedCall(gsap.utils.random(minDelay, Math.max(minDelay, maxDelay)), () => {
    if (CONFIG.jolt.enabled && !CONFIG.motion.paused) jolt();
    scheduleJolt();
  });
}

if (scene && !reducedMotion) scheduleJolt();

// ---------------------------------------------------------------------------
// Pointer: the blob reacts to it, a click or tap on it makes it twitch
// ---------------------------------------------------------------------------
const pointer = { x: 0, y: 0, active: false };
let pointerIdle = null;

window.addEventListener('pointermove', (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
  clearTimeout(pointerIdle);
  // Touch has no hover: let go shortly after the finger stops.
  if (event.pointerType !== 'mouse') pointerIdle = setTimeout(() => (pointer.active = false), 600);
});
root.addEventListener('pointerleave', () => (pointer.active = false));

window.addEventListener('pointerdown', (event) => {
  if (!scene || reducedMotion || !CONFIG.react.click) return;
  const blob = blobScreen();
  if (Math.hypot(event.clientX - blob.x, event.clientY - blob.y) > blob.r) return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  scene.poke();
  eyes.glance();
});

// ---------------------------------------------------------------------------
// Automatic quality: step down when frames get slow, carefully back up
// ---------------------------------------------------------------------------
const quality = { fps: 60, level: scene ? QUALITY_LEVELS[scene.level].name : 'ohne WebGL' };
// changedAt starts in the future: shader compiling makes the first frames slow.
const perf = { slowFor: 0, fastFor: 0, raises: 0, changedAt: performance.now() + 1500 };

function setQuality(level) {
  scene.setQuality(level);
  quality.level = QUALITY_LEVELS[scene.level].name;
  perf.changedAt = performance.now();
  perf.slowFor = perf.fastFor = 0;
}

// The first frames after returning to the tab measure the time away, not the
// device: skip them. Slow frames otherwise count, however slow they are.
let resumedAt = 0;
document.addEventListener('visibilitychange', () => (resumedAt = performance.now()));

function trackPerformance(deltaMs) {
  if (deltaMs <= 0 || document.hidden || performance.now() - resumedAt < 500) return;
  // Time-based average (about one second), so slow devices are judged as fast as quick ones.
  const weight = 1 - Math.exp(-Math.min(deltaMs, 1000) / 1000);
  quality.fps += (1000 / Math.min(deltaMs, 1000) - quality.fps) * weight;
  if (performance.now() - perf.changedAt < 1500) return; // let a new level settle
  if (!CONFIG.quality.auto) return;

  if (quality.fps < 40) {
    perf.slowFor += deltaMs;
    perf.fastFor = 0;
  } else if (quality.fps > 57) {
    perf.fastFor += deltaMs;
    perf.slowFor = 0;
  } else {
    perf.slowFor = perf.fastFor = 0;
  }

  if (perf.slowFor > 2000 && quality.fps < 40 && scene.level < QUALITY_LEVELS.length - 1) {
    setQuality(scene.level + 1);
  } else if (perf.fastFor > 8000 && scene.level > 0 && perf.raises < 2) {
    // Only twice, so a borderline device doesn't flip back and forth.
    perf.raises += 1;
    setQuality(scene.level - 1);
  }
}

// ---------------------------------------------------------------------------
// Render loop (driven by GSAP's ticker, shared with Lenis)
// ---------------------------------------------------------------------------
const name = document.querySelector('.name');
let textAlpha = 1;

gsap.ticker.add((time, deltaMs) => {
  const realDt = Math.min(deltaMs / 1000, 0.05);
  const dt = reducedMotion || CONFIG.motion.paused ? 0 : realDt * CONFIG.motion.timeScale;
  const progress = CONFIG.scroll.override ? CONFIG.scroll.progress : scroll.progress;

  // "Last light": at the very end the name fades and only the eyes are left.
  const end = Math.min(Math.max((progress - 0.85) / 0.12, 0), 1);
  const alpha = CONFIG.eyes.lastLight && CONFIG.eyes.visible ? 1 - end : 1;
  if (Math.abs(alpha - textAlpha) > 0.002) {
    textAlpha = alpha;
    name.style.setProperty('--text-alpha', alpha.toFixed(3));
  }

  if (scene) {
    trackPerformance(deltaMs);
    scene.update(dt, realDt, progress, pointer);
    scene.render(time);
    root.classList.add('webgl-ready');
  }
  eyes.update(realDt);
});

// ---------------------------------------------------------------------------
// Live controls: append #controls to the URL to show the tuning panel
// ---------------------------------------------------------------------------
// Everything the panel may touch. Most values are read live from CONFIG;
// these hooks apply the ones that need extra work.
const hooks = {
  CONFIG,
  DEFAULTS,
  QUALITY_LEVELS,
  quality,
  hasWebGL: !!scene,
  reducedMotion,
  applyColors,
  relayout: () => scene?.resize(),
  rebuildGeometry: () => scene?.rebuildGeometry(),
  syncUniforms() {
    scene?.syncUniforms();
    if (lenis) lenis.options.lerp = CONFIG.scroll.lerp;
  },
  setQuality(level) {
    if (scene) setQuality(level);
  },
  setEyesVisible: eyes.setVisible,
  setFollow: eyes.setFollow,
  jolt,
  blink: eyes.blink,
};

let controls = null;

async function syncControls() {
  const wanted = window.location.hash === '#controls';
  if (wanted && !controls) {
    const { createControls } = await import('./controls.js');
    controls = createControls(hooks);
  }
  controls?.setVisible(wanted);
}

window.addEventListener('hashchange', syncControls);
syncControls();
