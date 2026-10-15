// Eclipse corona: black where the surface faces the camera, glowing only
// at grazing angles (fresnel rim). Bloom turns the rim into the corona.
//
//   uColor      corona colour (linear; set from CONFIG.coronaColor in JS)
//   uRimPower   rim sharpness: 3.0 = spec; higher = thinner, sharper ring
//   uIntensity  rim brightness before bloom
//   uJolt       a jolt briefly flares the corona too

uniform vec3 uColor;
uniform float uRimPower;
uniform float uIntensity;
uniform float uJolt;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float facing = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
  float rim = pow(1.0 - facing, uRimPower);

  // 1.5 = how much a jolt flares the corona (keep low for a minimal palette).
  float flare = 1.0 + uJolt * 1.5;

  gl_FragColor = vec4(uColor * rim * uIntensity * flare, 1.0);
}
