// Ink blob: pushes every vertex in or out along its normal with noise.
//
//   uTime           noise phase; JS advances it by dt * CONFIG.shape.noiseSpeed
//   uEnergy         base writhing strength, driven by scroll (CONFIG.shape.energy*)
//   uNoiseFreq      lump size: higher = more, smaller lumps
//   uJolt           short spikes (~0.35) that decay to 0, fired from JS
//   uJoltSeed       random offset per jolt so each spasm has a new shape
//   uCrackleFreq    spike size during a jolt: higher = finer spikes
//   uCrackleAmount  spike strength during a jolt: higher = harsher spasms
//   uPointerDir     direction to the cursor, in the blob's own space
//   uReact          > 0 bulges towards the cursor, < 0 dents away from it
//   uReactSharpness narrow (high) or broad (low) bulge

uniform float uTime;
uniform float uEnergy;
uniform float uNoiseFreq;
uniform float uJolt;
uniform float uJoltSeed;
uniform float uCrackleFreq;
uniform float uCrackleAmount;
uniform vec3 uPointerDir;
uniform float uReact;
uniform float uReactSharpness;

#include <noise>

void main() {
  // Slow, organic base movement.
  float n = snoise(normal * uNoiseFreq + uTime);

  // Extra high-frequency crackle that only exists while a jolt is active.
  float crackle = snoise(normal * uCrackleFreq + uJoltSeed) * uJolt * uCrackleAmount;

  // Reaching for (or shrinking from) the cursor on the side that faces it.
  float facing = max(dot(normal, uPointerDir), 0.0);
  float react = uReact * pow(facing, uReactSharpness);

  vec3 displaced = position + normal * (n * (uEnergy + uJolt) + crackle + react);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
