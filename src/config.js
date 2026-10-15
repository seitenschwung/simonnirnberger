// Mood knobs. Everything you'd want to tweak lives here. All values are read
// live, so the panel at /#controls can change them while the page runs.
export const CONFIG = {
  paper: '#ebe6dc', // background
  ink: '#141313', // blob colour (text colours are derived from both)
  shape: {
    detail: 128, // icosahedron subdivisions (the quality level may lower it)
    energyStart: 0.12, // base writhing at the top of the page
    energyEnd: 0.3, // ... and at the bottom
    noiseFreq: 2.0, // lumps: higher = more, smaller lumps
    noiseSpeed: 0.4, // how fast the lumps flow
    crackleFreq: 5.0, // spikes during a jolt: higher = finer
    crackleAmount: 0.3, // spikes during a jolt: higher = harsher
    rotationSpeed: 0.04, // slow spin, radians per second
  },
  look: {
    handmade: true, // ink edges and uneven ink instead of a clean vector fill
    roughness: 2.5, // how far the edge frays, CSS pixels
    roughScale: 9, // size of the frayed bits, CSS pixels
    mottle: 0.08, // uneven ink: 0 = flat, 0.2 = blotchy
    boil: true, // "boiling line": the shape moves in steps like hand-drawn frames
    boilFps: 12, // drawings per second while boiling
  },
  react: {
    mode: 'attract', // 'attract' bulges towards the cursor, 'flinch' recoils, 'off'
    strength: 0.35, // how far it bulges or dents
    range: 0.6, // reach of the cursor, as a share of the smaller screen side
    sharpness: 3, // narrow (high) or broad (low) bulge
    click: true, // clicking or tapping the blob makes it twitch
  },
  layout: {
    startSize: 0.29, // blob radius at the top, as a share of half the screen height
    startX: 0.54, // blob centre at the top, as a share of half the screen width
    endCover: 1.08, // at the bottom the blob covers the screen with this margin
  },
  jolt: {
    enabled: true,
    amount: 0.35, // peak uJolt of a spasm
    decay: 0.4, // seconds until it has settled again
    minDelay: 0.5, // random pause between spasms, seconds
    maxDelay: 3.0,
    timeKick: 0.06, // jump in noise phase per spasm (the "snap")
  },
  motion: {
    paused: false, // freezes noise, spin and jolts
    timeScale: 1, // speed of everything time-based
  },
  scroll: {
    lerp: 0.06, // Lenis smoothing: lower = heavier inertia
    override: false, // drive the growth with `progress` instead of the scrollbar
    progress: 0,
  },
  grain: 0.035,
  eyes: {
    visible: true,
    follow: true, // follow the cursor (otherwise they watch the blob)
    reach: 2.6, // how far the pupils move (SVG units)
    blink: true,
    blinkMin: 2.5, // random pause between blinks, seconds
    blinkMax: 7,
    mood: true, // the closer the blob, the more nervous: wide eyes, small pupils, glances
    lastLight: true, // at the very end the name fades and only the eyes are left
  },
  quality: {
    auto: true, // lower (or raise) the quality to keep the frame rate up
    level: 0, // used when auto is off: index into QUALITY_LEVELS in scene.js
  },
};

export const DEFAULTS = structuredClone(CONFIG);
