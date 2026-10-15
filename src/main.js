import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import '@fontsource/rock-salt';
import '@fontsource/figtree/400.css';
import './style.css';

import noiseGlsl from './shaders/noise.glsl?raw';
import sphereVert from './shaders/sphere.vert?raw';
import sphereFrag from './shaders/sphere.frag?raw';
import passVert from './shaders/pass.vert?raw';
import finalFrag from './shaders/final.frag?raw';

// ---------------------------------------------------------------------------
// Mood knobs. Everything you'd want to tweak lives here. All values are read
// live, so the panel at /#controls can change them while the page runs.
// ---------------------------------------------------------------------------
const CONFIG = {
  paper: '#ebe6dc', // background
  ink: '#141313', // blob colour (text colours are derived from both)
  shape: {
    detail: 128, // icosahedron subdivisions (mobile uses at most 64)
    energyStart: 0.12, // base writhing at the top of the page
    energyEnd: 0.3, // ... and at the bottom
    noiseFreq: 2.0, // lumps: higher = more, smaller lumps
    noiseSpeed: 0.4, // how fast the lumps flow
    crackleFreq: 5.0, // spikes during a jolt: higher = finer
    crackleAmount: 0.3, // spikes during a jolt: higher = harsher
    rotationSpeed: 0.04, // slow spin, radians per second
  },
  layout: {
    startSize: 0.29, // blob radius at the top, as a share of half the screen height
    startX: 0.54, // blob centre at the top, as a share of half the screen width
    endCover: 1.08, // at the bottom the blob covers the screen with this margin
  },
  jolt: {
    enabled: true,
    amount: 0.35, // peak uJolt of a spasm
    decay: 0.4, // seconds until it has settled again
    minDelay: 0.5, // random pause between spasms, seconds
    maxDelay: 3.0,
    timeKick: 0.06, // jump in noise phase per spasm (the "snap")
  },
  motion: {
    paused: false, // freezes noise, spin and jolts
    timeScale: 1, // speed of everything time-based
  },
  scroll: {
    lerp: 0.06, // Lenis smoothing: lower = heavier inertia
    override: false, // drive the growth with `progress` instead of the scrollbar
    progress: 0,
  },
  grain: 0.035,
  eyes: {
    visible: true,
    follow: true, // follow the cursor (otherwise they watch the blob)
    reach: 2.6, // how far the pupils move (SVG units)
    blink: true,
    blinkMin: 2.5, // random pause between blinks, seconds
    blinkMax: 7,
  },
};

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

// Lets the vertex shader use `#include <noise>`.
THREE.ShaderChunk.noise = noiseGlsl;

const BASE_RADIUS = 1.2;
const lerp = THREE.MathUtils.lerp;

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // the composer renders to its own (multisampled) targets
  powerPreference: 'high-performance',
});
// Clear to transparent; the grain pass lays the paper underneath. Clearing
// straight to the paper colour would get sRGB-converted twice by the composer.
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();

// Narrow FOV from far away: hardly any perspective distortion, and the
// camera stays outside the blob even when it fills the whole screen.
const camera = new THREE.PerspectiveCamera(17.3, 1, 0.1, 100);
camera.position.set(0, 0, 14);
// Needed before the first render: lookAtBlob() projects through this camera.
camera.updateMatrixWorld();

// ---------------------------------------------------------------------------
// The blob
// ---------------------------------------------------------------------------
const blobUniforms = {
  uTime: { value: reducedMotion ? 1.2 : 0 }, // noise phase; frozen but not a perfect ball
  uEnergy: { value: CONFIG.shape.energyStart },
  uJolt: { value: 0 },
  uJoltSeed: { value: 0 },
  uNoiseFreq: { value: CONFIG.shape.noiseFreq },
  uCrackleFreq: { value: CONFIG.shape.crackleFreq },
  uCrackleAmount: { value: CONFIG.shape.crackleAmount },
  uInk: { value: new THREE.Color(CONFIG.ink) },
};

function blobGeometry() {
  return new THREE.IcosahedronGeometry(BASE_RADIUS, isMobile ? Math.min(CONFIG.shape.detail, 64) : CONFIG.shape.detail);
}

const blob = new THREE.Mesh(
  blobGeometry(),
  new THREE.ShaderMaterial({
    uniforms: blobUniforms,
    vertexShader: sphereVert,
    fragmentShader: sphereFrag,
  }),
);
scene.add(blob);

// ---------------------------------------------------------------------------
// Post-processing: render (multisampled) -> output (sRGB) -> paper + grain
// ---------------------------------------------------------------------------
const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isMobile ? 2 : 4 }),
);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());

const grainPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uGrain: { value: reducedMotion ? 0 : CONFIG.grain },
    // Final pass runs after OutputPass, so it wants raw sRGB (see applyColors).
    uPaper: { value: new THREE.Vector3() },
  },
  vertexShader: passVert,
  fragmentShader: finalFrag,
});
composer.addPass(grainPass);

// ---------------------------------------------------------------------------
// Colours: paper and ink drive the canvas and the CSS text colours
// ---------------------------------------------------------------------------
// Name and labels use mix-blend-mode: difference, so what shows on paper is
// |paper - colour|. To make the name show as ink and the labels as a soft grey,
// their CSS colours are paper minus the wanted colour.
function srgb(hex) {
  return new THREE.Color(hex).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
}

function cssColor({ r, g, b }) {
  const c = (v) => Math.round(THREE.MathUtils.clamp(v, 0, 1) * 255);
  return `rgb(${c(r)} ${c(g)} ${c(b)})`;
}

function applyColors() {
  const paper = srgb(CONFIG.paper);
  const ink = srgb(CONFIG.ink);
  const grey = { r: lerp(ink.r, paper.r, 0.3), g: lerp(ink.g, paper.g, 0.3), b: lerp(ink.b, paper.b, 0.3) };
  const minus = (a, b) => ({ r: Math.abs(a.r - b.r), g: Math.abs(a.g - b.g), b: Math.abs(a.b - b.b) });

  blobUniforms.uInk.value.set(CONFIG.ink);
  grainPass.uniforms.uPaper.value.set(paper.r, paper.g, paper.b);

  const root = document.documentElement.style;
  root.setProperty('--paper', cssColor(paper));
  root.setProperty('--ink', cssColor(ink));
  root.setProperty('--name', cssColor(minus(paper, ink)));
  root.setProperty('--muted', cssColor(minus(paper, grey)));
}

// ---------------------------------------------------------------------------
// Layout: where the blob sits depends on the viewport shape
// ---------------------------------------------------------------------------
const layout = { x: 0, y: 0, startScale: 1, endScale: 4 };

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  grainPass.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // Visible half-size of the screen at z = 0, in world units.
  const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const halfW = halfH * camera.aspect;

  if (camera.aspect >= 1) {
    layout.x = halfW * CONFIG.layout.startX;
    layout.y = 0;
    layout.startScale = (halfH * CONFIG.layout.startSize) / BASE_RADIUS;
  } else {
    // Portrait: the name takes the width, so the blob sits below it.
    layout.x = halfW * 0.3;
    layout.y = -halfH * 0.42;
    layout.startScale = Math.min(halfW * 0.42, halfH * CONFIG.layout.startSize) / BASE_RADIUS;
  }

  // Big enough that even its deepest dent still covers the screen corners.
  const minRadius = Math.max(BASE_RADIUS - CONFIG.shape.energyEnd, 0.2);
  layout.endScale = (Math.hypot(halfW, halfH) * CONFIG.layout.endCover) / minRadius;
}

window.addEventListener('resize', resize);
resize();

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
// The eyes in the "o": they watch the cursor (or the blob) and blink
// ---------------------------------------------------------------------------
const pupils = document.querySelector('.eyes__pupils');
const lids = document.querySelector('.eyes__lids');
const eyes = document.querySelector('.eyes');
const lookAt = { x: 1, y: 0 }; // direction, starts towards the blob

let pointerActive = false;
let pointerTimer = null;

// Pupils ease towards their target in the render loop (see updatePupils).
const pupilPos = { x: 0, y: 0 };

function updatePupils(dt) {
  if (!CONFIG.eyes.visible) return;
  const k = 1 - Math.exp(-dt * 10); // frame-rate independent easing
  pupilPos.x += (lookAt.x * CONFIG.eyes.reach - pupilPos.x) * k;
  pupilPos.y += (lookAt.y * CONFIG.eyes.reach - pupilPos.y) * k;
  pupils.setAttribute('transform', `translate(${pupilPos.x.toFixed(2)} ${pupilPos.y.toFixed(2)})`);
}

function lookTowards(clientX, clientY) {
  const box = eyes.getBoundingClientRect();
  const dx = clientX - (box.left + box.width / 2);
  const dy = clientY - (box.top + box.height / 2);
  const len = Math.hypot(dx, dy) || 1;
  const strength = Math.min(len / 200, 1);
  lookAt.x = (dx / len) * strength;
  lookAt.y = (dy / len) * strength;
}

function lookAtBlob() {
  const p = blob.position.clone().project(camera);
  lookTowards(((p.x + 1) / 2) * window.innerWidth, ((1 - p.y) / 2) * window.innerHeight);
}

// A jolt makes the eyes glance back at the blob.
function flinch() {
  if (!pointerActive || !CONFIG.eyes.follow) lookAtBlob();
}

function setEyesVisible(visible) {
  eyes.style.visibility = visible ? '' : 'hidden';
}

// ---------------------------------------------------------------------------
// Energy jolts: random spasms on top of the slow noise
// ---------------------------------------------------------------------------
function jolt() {
  const { amount, decay, timeKick } = CONFIG.jolt;
  blobUniforms.uJoltSeed.value = Math.random() * 100;
  blobUniforms.uTime.value += timeKick * Math.random();
  gsap.fromTo(
    blobUniforms.uJolt,
    { value: amount * gsap.utils.random(0.7, 1.2) },
    { value: 0, duration: decay, ease: 'expo.out', overwrite: true },
  );
  flinch();
}

// Delays are re-read every time, so changes apply from the next spasm on.
function scheduleJolt() {
  const { minDelay, maxDelay } = CONFIG.jolt;
  gsap.delayedCall(gsap.utils.random(minDelay, Math.max(minDelay, maxDelay)), () => {
    if (CONFIG.jolt.enabled && !CONFIG.motion.paused) jolt();
    scheduleJolt();
  });
}

function blink() {
  gsap.to(lids, { scaleY: 0.08, duration: 0.07, yoyo: true, repeat: 1, ease: 'power2.in' });
}

function scheduleBlink() {
  const { blinkMin, blinkMax } = CONFIG.eyes;
  gsap.delayedCall(gsap.utils.random(blinkMin, Math.max(blinkMin, blinkMax)), () => {
    if (CONFIG.eyes.blink && CONFIG.eyes.visible) blink();
    scheduleBlink();
  });
}

if (!reducedMotion) {
  window.addEventListener('pointermove', (event) => {
    if (!CONFIG.eyes.follow) return;
    pointerActive = true;
    lookTowards(event.clientX, event.clientY);
    clearTimeout(pointerTimer);
    pointerTimer = setTimeout(() => {
      pointerActive = false;
      lookAtBlob();
    }, 2500);
  });

  scheduleBlink();
  scheduleJolt();
}

// ---------------------------------------------------------------------------
// Render loop (driven by GSAP's ticker, shared with Lenis)
// ---------------------------------------------------------------------------
function applyScroll() {
  // Exponential growth reads as a steady "swallowing" rather than a late burst.
  const p = CONFIG.scroll.override ? CONFIG.scroll.progress : scroll.progress;
  const scale = layout.startScale * Math.pow(layout.endScale / layout.startScale, p);
  blob.scale.setScalar(scale);
  blob.position.set(lerp(layout.x, 0, p), lerp(layout.y, 0, p), 0);
  blobUniforms.uEnergy.value = lerp(CONFIG.shape.energyStart, CONFIG.shape.energyEnd, p);
}

applyColors();
applyScroll();
lookAtBlob();

gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.05);

  if (!reducedMotion) {
    const t = CONFIG.motion.paused ? 0 : dt * CONFIG.motion.timeScale;
    blobUniforms.uTime.value += t * CONFIG.shape.noiseSpeed;
    blob.rotation.y += t * CONFIG.shape.rotationSpeed;
    grainPass.uniforms.uTime.value = time;
    updatePupils(dt);
  }

  applyScroll();
  composer.render();
});

// ---------------------------------------------------------------------------
// Live controls: append #controls to the URL to show the tuning panel
// ---------------------------------------------------------------------------
const DEFAULTS = structuredClone(CONFIG);

// Everything the panel may touch. Most values are read live from CONFIG;
// these hooks apply the ones that need extra work.
const scene3d = {
  CONFIG,
  DEFAULTS,
  reducedMotion,
  applyColors,
  relayout: resize,
  rebuildGeometry() {
    blob.geometry.dispose();
    blob.geometry = blobGeometry();
  },
  syncUniforms() {
    blobUniforms.uNoiseFreq.value = CONFIG.shape.noiseFreq;
    blobUniforms.uCrackleFreq.value = CONFIG.shape.crackleFreq;
    blobUniforms.uCrackleAmount.value = CONFIG.shape.crackleAmount;
    grainPass.uniforms.uGrain.value = reducedMotion ? 0 : CONFIG.grain;
    if (lenis) lenis.options.lerp = CONFIG.scroll.lerp;
  },
  setEyesVisible,
  setFollow(follow) {
    if (!follow) {
      pointerActive = false;
      lookAtBlob();
    }
  },
  jolt,
  blink,
};

let controls = null;

async function syncControls() {
  const wanted = window.location.hash === '#controls';
  if (wanted && !controls) {
    const { createControls } = await import('./controls.js');
    controls = createControls(scene3d);
  }
  controls?.setVisible(wanted);
}

window.addEventListener('hashchange', syncControls);
syncControls();
