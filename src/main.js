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
// Mood knobs. Everything you'd want to tweak lives here.
// ---------------------------------------------------------------------------
const CONFIG = {
  paper: '#ebe6dc', // background (keep in sync with --paper in style.css)
  ink: '#141313', // blob colour
  energy: [0.12, 0.3], // base writhing: top of page -> bottom
  startSize: 0.29, // blob radius at the top, as a share of half the screen height
  endCover: 1.08, // at the bottom the blob covers the screen with this margin
  startX: 0.54, // blob centre at the top, as a share of half the screen width
  jolt: {
    amount: 0.35, // peak uJolt of a spasm
    decay: 0.4, // seconds until it has settled again
    minDelay: 0.5, // random pause between spasms, seconds
    maxDelay: 3.0,
    timeKick: 0.15, // jump in noise time per spasm (the "snap")
  },
  grain: 0.035,
  eyes: {
    reach: 2.6, // how far the pupils move (SVG units)
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
// Smallest radius the noise can pull the surface in to (at full energy).
const MIN_RADIUS = BASE_RADIUS - CONFIG.energy[1];

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
  uTime: { value: reducedMotion ? 3.0 : 0 }, // frozen but not a perfect ball
  uEnergy: { value: CONFIG.energy[0] },
  uJolt: { value: 0 },
  uJoltSeed: { value: 0 },
  uInk: { value: new THREE.Color(CONFIG.ink) },
};

const blob = new THREE.Mesh(
  new THREE.IcosahedronGeometry(BASE_RADIUS, isMobile ? 64 : 128),
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

const paperSrgb = new THREE.Color(CONFIG.paper).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);

const grainPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uGrain: { value: reducedMotion ? 0 : CONFIG.grain },
    // Final pass runs after OutputPass, so it wants the raw sRGB values.
    uPaper: { value: new THREE.Vector3(paperSrgb.r, paperSrgb.g, paperSrgb.b) },
  },
  vertexShader: passVert,
  fragmentShader: finalFrag,
});
composer.addPass(grainPass);

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
    layout.x = halfW * CONFIG.startX;
    layout.y = 0;
    layout.startScale = (halfH * CONFIG.startSize) / BASE_RADIUS;
  } else {
    // Portrait: the name takes the width, so the blob sits below it.
    layout.x = halfW * 0.3;
    layout.y = -halfH * 0.42;
    layout.startScale = Math.min(halfW * 0.42, halfH * CONFIG.startSize) / BASE_RADIUS;
  }

  // Big enough that even its deepest dent still covers the screen corners.
  layout.endScale = (Math.hypot(halfW, halfH) * CONFIG.endCover) / MIN_RADIUS;
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
  lenis = new Lenis({ lerp: 0.06, wheelMultiplier: 0.9 });
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
  if (!pointerActive) lookAtBlob();
}

// ---------------------------------------------------------------------------
// Energy jolts: random spasms on top of the slow noise
// ---------------------------------------------------------------------------
function scheduleJolt() {
  const { amount, decay, minDelay, maxDelay, timeKick } = CONFIG.jolt;
  gsap.delayedCall(gsap.utils.random(minDelay, maxDelay), () => {
    blobUniforms.uJoltSeed.value = Math.random() * 100;
    blobUniforms.uTime.value += timeKick * Math.random();
    gsap.fromTo(
      blobUniforms.uJolt,
      { value: amount * gsap.utils.random(0.7, 1.2) },
      { value: 0, duration: decay, ease: 'expo.out', overwrite: true },
    );
    flinch();
    scheduleJolt();
  });
}

function scheduleBlink() {
  gsap.delayedCall(gsap.utils.random(CONFIG.eyes.blinkMin, CONFIG.eyes.blinkMax), () => {
    gsap.to(lids, { scaleY: 0.08, duration: 0.07, yoyo: true, repeat: 1, ease: 'power2.in' });
    scheduleBlink();
  });
}

if (!reducedMotion) {
  window.addEventListener('pointermove', (event) => {
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
const lerp = THREE.MathUtils.lerp;

function applyScroll() {
  // Exponential growth reads as a steady "swallowing" rather than a late burst.
  const p = scroll.progress;
  const scale = layout.startScale * Math.pow(layout.endScale / layout.startScale, p);
  blob.scale.setScalar(scale);
  blob.position.set(lerp(layout.x, 0, p), lerp(layout.y, 0, p), 0);
  blobUniforms.uEnergy.value = lerp(CONFIG.energy[0], CONFIG.energy[1], p);
}

applyScroll();
lookAtBlob();

gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.05);

  if (!reducedMotion) {
    blobUniforms.uTime.value += dt;
    grainPass.uniforms.uTime.value = time;
    blob.rotation.y += dt * 0.04;
    updatePupils(dt);
  }

  applyScroll();
  composer.render();
});
