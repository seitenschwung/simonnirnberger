// Last post-processing step: paper underneath, then grain.
//
//   uPaper  paper colour (sRGB) shown wherever nothing was drawn
//   uGrain  grain amount (0 = off, used for prefers-reduced-motion)

uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uTime;
uniform float uGrain;
uniform vec3 uPaper;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  // The scene was cleared to transparent black, so its colour is already
  // premultiplied by alpha: add the paper only where the blob is not.
  vec4 scene = texture2D(tDiffuse, vUv);
  vec3 color = scene.rgb + uPaper * (1.0 - scene.a);

  // Grain changes every frame; floor() keeps it in whole-pixel cells.
  float grain = hash(floor(vUv * uResolution) + fract(uTime) * 1000.0) - 0.5;
  color += grain * uGrain;

  gl_FragColor = vec4(color, 1.0);
}
