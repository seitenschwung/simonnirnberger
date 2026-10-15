// The blob is a flat patch of ink: no lighting, no rim, no glow.
// All the life comes from the silhouette moving in sphere.vert.
//
//   uInk  ink colour (linear; set from CONFIG.ink in JS)

uniform vec3 uInk;

void main() {
  gl_FragColor = vec4(uInk, 1.0);
}
