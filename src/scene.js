// The WebGL part: the ink blob, its post-processing and quality levels.
// createScene() throws if WebGL is unavailable; main.js then keeps the static
// fallback blob from index.html instead.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import gsap from 'gsap';

import noiseGlsl from './shaders/noise.glsl?raw';
import sphereVert from './shaders/sphere.vert?raw';
import sphereFrag from './shaders/sphere.frag?raw';
import passVert from './shaders/pass.vert?raw';
import finalFrag from './shaders/final.frag?raw';

// From best to cheapest. Automatic quality steps through these.
export const QUALITY_LEVELS = [
  { name: 'hoch', pixelRatio: 2, samples: 4, detail: 128 },
  { name: 'mittel', pixelRatio: 1.5, samples: 4, detail: 96 },
  { name: 'niedrig', pixelRatio: 1, samples: 2, detail: 64 },
  { name: 'minimal', pixelRatio: 0.75, samples: 0, detail: 32 },
];

const BASE_RADIUS = 1.2;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;

// Lets the vertex shader use `#include <noise>`.
THREE.ShaderChunk.noise = noiseGlsl;

export function createScene(canvas, CONFIG, { reducedMotion, level: startLevel }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // the composer renders to its own (multisampled) targets
    powerPreference: 'high-performance',
  });
  // Clear to transparent; the final pass lays the paper underneath. Clearing
  // straight to the paper colour would get sRGB-converted twice by the composer.
  renderer.setClearColor(0x000000, 0);

  let level = clamp(startLevel, 0, QUALITY_LEVELS.length - 1);

  const scene = new THREE.Scene();

  // Narrow FOV from far away: hardly any perspective distortion, and the
  // camera stays outside the blob even when it fills the whole screen.
  const camera = new THREE.PerspectiveCamera(17.3, 1, 0.1, 100);
  camera.position.set(0, 0, 14);
  // Needed before the first render: blobScreen() projects through this camera.
  camera.updateMatrixWorld();

  // --- The blob --------------------------------------------------------------
  const uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: CONFIG.shape.energyStart },
    uJolt: { value: 0 },
    uJoltSeed: { value: 0 },
    uNoiseFreq: { value: CONFIG.shape.noiseFreq },
    uCrackleFreq: { value: CONFIG.shape.crackleFreq },
    uCrackleAmount: { value: CONFIG.shape.crackleAmount },
    uPointerDir: { value: new THREE.Vector3(1, 0, 0) },
    uReact: { value: 0 },
    uReactSharpness: { value: CONFIG.react.sharpness },
    uInk: { value: new THREE.Color(CONFIG.ink) },
  };

  const detail = () => Math.min(CONFIG.shape.detail, QUALITY_LEVELS[level].detail);
  let builtDetail = detail();

  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(BASE_RADIUS, builtDetail),
    new THREE.ShaderMaterial({ uniforms, vertexShader: sphereVert, fragmentShader: sphereFrag }),
  );
  scene.add(blob);

  function rebuildGeometry() {
    if (detail() === builtDetail) return;
    builtDetail = detail();
    blob.geometry.dispose();
    blob.geometry = new THREE.IcosahedronGeometry(BASE_RADIUS, builtDetail);
  }

  // --- Post-processing: render (multisampled) -> output (sRGB) -> ink + paper + grain
  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: QUALITY_LEVELS[level].samples }),
  );
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  const finalPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uGrain: { value: 0 },
      // Runs after OutputPass, so it wants raw sRGB (see setColors).
      uPaper: { value: new THREE.Vector3() },
      uHandmade: { value: 0 },
      uRoughness: { value: 0 },
      uRoughScale: { value: 1 },
      uMottle: { value: 0 },
      uSeed: { value: 0 },
    },
    vertexShader: passVert,
    fragmentShader: finalFrag,
  });
  composer.addPass(finalPass);

  // --- Layout: where the blob sits depends on the viewport shape -------------
  const layout = { x: 0, y: 0, startScale: 1, endScale: 4 };
  let pixelRatio = 1;

  function syncUniforms() {
    uniforms.uNoiseFreq.value = CONFIG.shape.noiseFreq;
    uniforms.uCrackleFreq.value = CONFIG.shape.crackleFreq;
    uniforms.uCrackleAmount.value = CONFIG.shape.crackleAmount;
    uniforms.uReactSharpness.value = CONFIG.react.sharpness;
    const u = finalPass.uniforms;
    u.uGrain.value = reducedMotion ? 0 : CONFIG.grain;
    u.uHandmade.value = CONFIG.look.handmade ? 1 : 0;
    u.uRoughness.value = CONFIG.look.roughness * pixelRatio;
    u.uRoughScale.value = Math.max(CONFIG.look.roughScale, 1) * pixelRatio;
    u.uMottle.value = CONFIG.look.mottle;
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio, QUALITY_LEVELS[level].pixelRatio);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    finalPass.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    syncUniforms();

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

  function setQuality(newLevel) {
    level = clamp(newLevel, 0, QUALITY_LEVELS.length - 1);
    // Multisampling is fixed when a render target is created: drop and rebuild.
    for (const target of [composer.renderTarget1, composer.renderTarget2]) {
      target.samples = QUALITY_LEVELS[level].samples;
      target.dispose();
    }
    rebuildGeometry();
    resize();
  }

  // sRGB paper (0..1) for the final pass, hex ink for the blob.
  function setColors(paper, inkHex) {
    uniforms.uInk.value.set(inkHex);
    finalPass.uniforms.uPaper.value.set(paper.r, paper.g, paper.b);
  }

  // --- Where the blob is on screen, in CSS pixels ----------------------------
  const projected = new THREE.Vector3();
  function blobScreen() {
    projected.copy(blob.position).project(camera);
    const x = ((projected.x + 1) / 2) * window.innerWidth;
    const y = ((1 - projected.y) / 2) * window.innerHeight;
    projected.copy(blob.position).add({ x: BASE_RADIUS * blob.scale.x, y: 0, z: 0 }).project(camera);
    const r = Math.abs(((projected.x + 1) / 2) * window.innerWidth - x);
    return { x, y, r };
  }

  // --- Motion ------------------------------------------------------------------
  let phase = reducedMotion ? 1.2 : 0; // noise phase: frozen but not a perfect ball
  const joltState = { value: 0 };
  let react = 0;
  const pointerDir = new THREE.Vector3(1, 0, 0);
  const inverseRotation = new THREE.Quaternion();
  let boilClock = 0;
  let boilFrame = 0;

  function jolt() {
    const { amount, decay, timeKick } = CONFIG.jolt;
    uniforms.uJoltSeed.value = Math.random() * 100;
    phase += timeKick * Math.random();
    gsap.fromTo(
      joltState,
      { value: amount * gsap.utils.random(0.7, 1.2) },
      { value: 0, duration: decay, ease: 'expo.out', overwrite: true },
    );
  }

  // A click or tap on the blob: a twitch, and an extra push of the reaction.
  function poke() {
    jolt();
    const sign = CONFIG.react.mode === 'flinch' ? -1 : 1;
    if (CONFIG.react.mode !== 'off') react = sign * CONFIG.react.strength * 1.6;
  }

  // dt: animation time (0 while paused), realDt: wall-clock time for easing.
  function update(dt, realDt, progress, pointer) {
    phase += dt * CONFIG.shape.noiseSpeed;
    blob.rotation.y += dt * CONFIG.shape.rotationSpeed;

    // Scroll: exponential growth reads as a steady "swallowing", not a late burst.
    const scale = layout.startScale * Math.pow(layout.endScale / layout.startScale, progress);
    blob.scale.setScalar(scale);
    blob.position.set(lerp(layout.x, 0, progress), lerp(layout.y, 0, progress), 0);
    uniforms.uEnergy.value = lerp(CONFIG.shape.energyStart, CONFIG.shape.energyEnd, progress);

    // Cursor: the closer it gets, the more the blob reaches for it (or recoils).
    let target = 0;
    if (CONFIG.react.mode !== 'off' && pointer.active && !reducedMotion) {
      const s = blobScreen();
      const dx = pointer.x - s.x;
      const dy = pointer.y - s.y;
      const distance = Math.hypot(dx, dy);
      const range = Math.max(CONFIG.react.range * Math.min(window.innerWidth, window.innerHeight), 1);
      const near = clamp(1 - Math.max(distance - s.r, 0) / range, 0, 1);
      const ease = near * near * (3 - 2 * near); // smoothstep: soft start, full strength up close
      target = (CONFIG.react.mode === 'flinch' ? -1 : 1) * CONFIG.react.strength * ease;
      // A little towards the camera, so the bulge shows on the outline.
      if (distance > 1) pointerDir.set(dx / distance, -dy / distance, 0.35).normalize();
    }
    // Flinching snaps away quickly; everything else eases.
    const speed = CONFIG.react.mode === 'flinch' && Math.abs(target) > Math.abs(react) ? 14 : 4;
    react += (target - react) * (1 - Math.exp(-realDt * speed));

    // "Boiling line": shape uniforms change only on whole drawing frames.
    const boiling = CONFIG.look.handmade && CONFIG.look.boil && !reducedMotion;
    let redraw = true;
    if (boiling) {
      const frame = 1 / Math.max(CONFIG.look.boilFps, 1);
      boilClock += realDt;
      redraw = boilClock >= frame;
      if (redraw) {
        boilClock %= frame;
        boilFrame = (boilFrame + 1) % 64;
        finalPass.uniforms.uSeed.value = boilFrame * 1.37;
      }
    }
    if (redraw) {
      uniforms.uTime.value = phase;
      uniforms.uJolt.value = joltState.value;
      uniforms.uReact.value = react;
      inverseRotation.copy(blob.quaternion).invert();
      uniforms.uPointerDir.value.copy(pointerDir).applyQuaternion(inverseRotation);
    }
  }

  function render(time) {
    finalPass.uniforms.uTime.value = time;
    composer.render();
  }

  resize();

  return {
    resize,
    update,
    render,
    jolt,
    poke,
    blobScreen,
    setColors,
    syncUniforms,
    rebuildGeometry,
    setQuality,
    get level() {
      return level;
    },
  };
}
