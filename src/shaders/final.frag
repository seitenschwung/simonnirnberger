// Last post-processing step: hand-made ink look, paper underneath, grain.
//
//   uPaper       paper colour (sRGB) shown wherever nothing was drawn
//   uHandmade    1 = ink look on, 0 = clean vector fill
//   uRoughness   how far the ink edge frays, in device pixels
//   uRoughScale  size of the frayed bits, in device pixels
//   uMottle      uneven ink: 0 = flat, 0.2 = blotchy
//   uSeed        changes with every "boiling line" frame, so the edge redraws
//   uGrain       grain amount (0 = off, used for prefers-reduced-motion)

uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uGrain;
uniform vec3 uPaper;
uniform float uHandmade;
uniform float uRoughness;
uniform float uRoughScale;
uniform float uMottle;
uniform float uSeed;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Smooth 2D value noise and a few octaves of it (fbm), roughly 0..1.
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * valueNoise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 pixel = vUv * uResolution;
  vec2 uv = vUv;

  // Fray the edge: read the scene from a slightly shifted spot. Inside the
  // blob and on bare paper nothing changes; only the outline turns ragged.
  if (uHandmade > 0.5) {
    vec2 q = pixel / uRoughScale + uSeed;
    vec2 shift = vec2(fbm(q), fbm(q + 17.3)) - 0.5;
    uv += shift * 2.0 * uRoughness / uResolution;
  }

  // The scene was cleared to transparent black, so its colour is already
  // premultiplied by alpha: add the paper only where the blob is not.
  vec4 scene = texture2D(tDiffuse, uv);

  // Uneven ink: soft patches where it lightens towards the paper.
  if (uHandmade > 0.5) {
    float patches = fbm(pixel / (uRoughScale * 14.0) + uSeed * 0.31);
    scene.rgb = mix(scene.rgb, uPaper * scene.a, patches * uMottle);
  }

  vec3 color = scene.rgb + uPaper * (1.0 - scene.a);

  // Grain changes every frame; floor() keeps it in whole-pixel cells.
  float grain = hash(floor(pixel) + fract(uTime) * 1000.0) - 0.5;
  color += grain * uGrain;

  gl_FragColor = vec4(color, 1.0);
}
