// Ink blob: pushes every vertex in or out along its normal with noise.
//
//   uTime           noise phase; JS advances it by dt * CONFIG.shape.noiseSpeed
//   uEnergy         base writhing strength, driven by scroll (CONFIG.shape.energy*)
//   uNoiseFreq      lump size: higher = more, smaller lumps
//   uJolt           short spikes (~0.35) that decay to 0, fired from JS
//   uJoltSeed       random offset per jolt so each spasm has a new shape
//   uCrackleFreq    spike size during a jolt: higher = finer spikes
//   uCrackleAmount  spike strength during a jolt: higher = harsher spasms

uniform float uTime;
uniform float uEnergy;
uniform float uNoiseFreq;
uniform float uJolt;
uniform float uJoltSeed;
uniform float uCrackleFreq;
uniform float uCrackleAmount;

#include <noise>

void main() {
  // Slow, organic base movement.
  float n = snoise(normal * uNoiseFreq + uTime);

  // Extra high-frequency crackle that only exists while a jolt is active.
  float crackle = snoise(normal * uCrackleFreq + uJoltSeed) * uJolt * uCrackleAmount;

  vec3 displaced = position + normal * (n * (uEnergy + uJolt) + crackle);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
