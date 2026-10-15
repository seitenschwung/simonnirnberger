// Last post-processing step: chromatic aberration, vignette, film grain.
//
//   uAberration  RGB split strength, grows towards the screen edges
//   uGrain       grain amount (0 = off, used for prefers-reduced-motion)
//   uCrush       contrast curve; >1 keeps bloom haze dark, only the rim glows

uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uAberration;
uniform float uGrain;
uniform float uCrush;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 dir = vUv - 0.5;
  float dist = length(dir);
  vec2 offset = dir * dist * uAberration;

  vec3 color = vec3(
    texture2D(tDiffuse, vUv + offset).r,
    texture2D(tDiffuse, vUv).g,
    texture2D(tDiffuse, vUv - offset).b
  );

  // Crush the low end: faint bloom spill falls back to black.
  color = pow(color, vec3(uCrush));

  // Soft vignette pulls the eye towards the sphere.
  color *= 1.0 - dist * dist * 0.6;

  // Grain changes every frame; floor() keeps it in whole-pixel cells.
  float grain = hash(floor(vUv * uResolution) + fract(uTime) * 1000.0) - 0.5;
  color += grain * uGrain;

  gl_FragColor = vec4(color, 1.0);
}
