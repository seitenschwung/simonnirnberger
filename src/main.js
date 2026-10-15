import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import '@fontsource/nosifer';
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
  coronaColor: '#991a1f', // dark blood red
  rimPower: 4.5, // corona sharpness (higher = thinner ring)
  rimIntensity: 0.35, // corona brightness before bloom (bloom adds a lot)
  rimFalloff: 1.0, // how much the corona dims as the sphere grows (0 = not)
  energy: [0.15, 0.4], // base writhing: top of page -> bottom
  scale: [1, 4], // sphere size: top -> bottom
  startX: 1.8, // sphere x at the top (world units, 0 = centre)
  jolt: {
    amount: 0.35, // peak uJolt of a spasm
    decay: 0.4, // seconds until it has settled again
    minDelay: 0.5, // random pause between spasms, seconds
    maxDelay: 3.0,
    timeKick: 0.15, // jump in noise time per spasm (the "snap")
  },
  bloom: { strength: 0.9, radius: 0.35, threshold: 0 },
  aberration: 0.012,
  grain: 0.05,
  crush: 1.6, // >1 pushes dark glow back to black (less colour haze)
  particles: { desktop: 1400, mobile: 500, color: '#8a8380' },
};

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;

// Lets the vertex shader use `#include <noise>`.
THREE.ShaderChunk.noise = noiseGlsl;

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // the composer renders to its own targets anyway
  powerPreference: 'high-performance',
});
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();

// Narrow FOV from far away: little perspective distortion, and the camera
// stays outside the sphere even at full scale (radius 4.8 + displacement).
const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
camera.position.set(0, 0, 10);

// ---------------------------------------------------------------------------
// The dark sun
// ---------------------------------------------------------------------------
const sphereUniforms = {
  uTime: { value: reducedMotion ? 3.0 : 0 }, // frozen but not a perfect ball
  uEnergy: { value: CONFIG.energy[0] },
  uJolt: { value: 0 },
  uJoltSeed: { value: 0 },
  uColor: { value: new THREE.Color(CONFIG.coronaColor) },
  uRimPower: { value: CONFIG.rimPower },
  uIntensity: { value: CONFIG.rimIntensity },
};

const sphere = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.2, isMobile ? 64 : 128),
  new THREE.ShaderMaterial({
    uniforms: sphereUniforms,
    vertexShader: sphereVert,
    fragmentShader: sphereFrag,
  }),
);
scene.add(sphere);

// ---------------------------------------------------------------------------
// Particles slowly pulled into the sphere
// ---------------------------------------------------------------------------
const particleCount = isMobile ? CONFIG.particles.mobile : CONFIG.particles.desktop;
const particlePositions = new Float32Array(particleCount * 3);
const particleSpeeds = new Float32Array(particleCount);
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

const particles = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({
    color: CONFIG.particles.color,
    size: 0.018,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
scene.add(particles);

const tmp = new THREE.Vector3();

function spawnParticle(i, center, minR, maxR) {
  tmp.randomDirection().multiplyScalar(THREE.MathUtils.randFloat(minR, maxR));
  particlePositions[i * 3] = center.x + tmp.x;
  particlePositions[i * 3 + 1] = center.y + tmp.y;
  particlePositions[i * 3 + 2] = center.z + tmp.z * 0.5; // flatter towards camera
  particleSpeeds[i] = THREE.MathUtils.randFloat(0.15, 0.5);
}

function initParticles() {
  for (let i = 0; i < particleCount; i++) spawnParticle(i, sphere.position, 2, 9);
  particleGeometry.attributes.position.needsUpdate = true;
}

function updateParticles(dt) {
  const center = sphere.position;
  const radius = 1.2 * sphere.scale.x;
  for (let i = 0; i < particleCount; i++) {
    const ix = i * 3;
    const dx = center.x - particlePositions[ix];
    const dy = center.y - particlePositions[ix + 1];
    const dz = center.z - particlePositions[ix + 2];
    const dist = Math.hypot(dx, dy, dz);

    if (dist < radius * 0.98) {
      spawnParticle(i, center, radius + 3, radius + 9);
      continue;
    }

    // Faster the closer they get; a little swirl around the z axis.
    const pull = (particleSpeeds[i] * dt * (1 + 3 / dist)) / dist;
    const swirl = pull * 0.35;
    particlePositions[ix] += dx * pull - dy * swirl;
    particlePositions[ix + 1] += dy * pull + dx * swirl;
    particlePositions[ix + 2] += dz * pull;
  }
  particleGeometry.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Post-processing: bloom -> output (sRGB) -> aberration + grain
// ---------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(1, 1),
  CONFIG.bloom.strength,
  CONFIG.bloom.radius,
  CONFIG.bloom.threshold,
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const finalPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uAberration: { value: CONFIG.aberration },
    uGrain: { value: reducedMotion ? 0 : CONFIG.grain },
    uCrush: { value: CONFIG.crush },
  },
  vertexShader: passVert,
  fragmentShader: finalFrag,
});
composer.addPass(finalPass);

// ---------------------------------------------------------------------------
// Layout: where the sphere sits depends on the viewport shape
// ---------------------------------------------------------------------------
const layout = { x: CONFIG.startX, y: 0, scale: 1 };

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(width, height);
  // Bloom at half resolution on mobile: much cheaper, looks the same.
  if (isMobile) bloomPass.setSize((width * pixelRatio) / 2, (height * pixelRatio) / 2);
  finalPass.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  // Visible half-width at z = 0, so the sphere never starts off-screen.
  const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const halfW = halfH * camera.aspect;
  if (camera.aspect >= 1) {
    layout.x = Math.min(CONFIG.startX, halfW * 0.5);
    layout.y = 0;
    layout.scale = Math.min(1, halfW / 2.6);
  } else {
    // Portrait: the name takes the width, so the sun rises from below it.
    layout.x = halfW * 0.3;
    layout.y = -halfH * 0.42;
    layout.scale = Math.min(1, halfW / 1.7);
  }
}

window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Scroll: sphere grows and drifts to the centre, the name stays put
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

gsap.to(scroll, {
  progress: 1,
  ease: 'none',
  scrollTrigger: {
    trigger: 'main',
    start: 'top top',
    end: 'bottom bottom',
    scrub: reducedMotion ? true : 1,
  },
});

// ---------------------------------------------------------------------------
// Energy jolts: random spasms on top of the slow noise
// ---------------------------------------------------------------------------
function scheduleJolt() {
  const { amount, decay, minDelay, maxDelay, timeKick } = CONFIG.jolt;
  gsap.delayedCall(gsap.utils.random(minDelay, maxDelay), () => {
    sphereUniforms.uJoltSeed.value = Math.random() * 100;
    sphereUniforms.uTime.value += timeKick * Math.random();
    gsap.fromTo(
      sphereUniforms.uJolt,
      { value: amount * gsap.utils.random(0.7, 1.2) },
      { value: 0, duration: decay, ease: 'expo.out', overwrite: true },
    );
    scheduleJolt();
  });
}

if (!reducedMotion) scheduleJolt();

// ---------------------------------------------------------------------------
// Render loop (driven by GSAP's ticker, shared with Lenis)
// ---------------------------------------------------------------------------
const lerp = THREE.MathUtils.lerp;

function applyScroll() {
  const p = scroll.progress;
  const s = lerp(CONFIG.scale[0], CONFIG.scale[1], p);
  sphere.scale.setScalar(s * layout.scale);
  // The rim band grows with the sphere; dim it so the colour stays minimal.
  sphereUniforms.uIntensity.value = CONFIG.rimIntensity / Math.pow(s, CONFIG.rimFalloff);
  sphere.position.set(lerp(layout.x, 0, p), lerp(layout.y, 0, p), 0);
  sphereUniforms.uEnergy.value = lerp(CONFIG.energy[0], CONFIG.energy[1], p);
}

applyScroll();
initParticles();

gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.05);

  if (!reducedMotion) {
    sphereUniforms.uTime.value += dt;
    finalPass.uniforms.uTime.value = time;
    sphere.rotation.y += dt * 0.04;
    updateParticles(dt);
  }

  applyScroll();
  composer.render();
});
