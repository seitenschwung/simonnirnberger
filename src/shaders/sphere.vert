// Dark sun: pushes every vertex in or out along its normal with noise.
//
//   uTime      seconds; noise flow speed is the 0.4 factor below
//   uEnergy    base writhing strength, driven by scroll (0.15 -> 0.4)
//   uJolt      short spikes (~0.35) that decay to 0, fired from JS
//   uJoltSeed  random offset per jolt so each spasm has a new shape

uniform float uTime;
uniform float uEnergy;
uniform float uJolt;
uniform float uJoltSeed;

varying vec3 vNormal;
varying vec3 vViewDir;

#include <noise>

void main() {
  // Slow, organic base movement.
  //   normal * 2.0 -> noise frequency (higher = more, smaller lumps)
  //   uTime  * 0.4 -> flow speed
  float n = snoise(normal * 2.0 + uTime * 0.4);

  // Extra high-frequency crackle that only exists while a jolt is active.
  // Raise 6.0 for finer spikes, raise 0.5 for harsher spasms.
  float crackle = snoise(normal * 6.0 + uJoltSeed) * uJolt * 0.5;

  vec3 displaced = position + normal * (n * (uEnergy + uJolt) + crackle);

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);

  // The undisplaced normal is used on purpose: the fresnel rim stays at the
  // silhouette, so the centre remains pure black while the outline writhes.
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);

  gl_Position = projectionMatrix * mvPosition;
}
