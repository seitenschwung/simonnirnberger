// The eyes in the "o" of Simon. They watch the cursor (or the blob), blink,
// and get nervous as the blob comes closer.
import gsap from 'gsap';

const PUPIL_RADIUS = 3.6; // matches index.html

export function createEyes(CONFIG, { reducedMotion, blobScreen }) {
  const eyes = document.querySelector('.eyes');
  const lids = eyes.querySelector('.eyes__lids');
  const pupilGroup = eyes.querySelector('.eyes__pupils');
  const pupils = eyes.querySelectorAll('.eyes__pupil');

  const look = { x: 1, y: 0 }; // where the pupils want to go (-1..1)
  const cursorLook = { x: 1, y: 0 };
  const pupilPos = { x: 0, y: 0 };
  let pointerActive = false;
  let pointerTimer = null;
  let fear = 0; // 0 calm .. 1 the blob is on top of them
  let glanceUntil = 0;
  const glanceJitter = { x: 0, y: 0 };

  function centre() {
    const box = eyes.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }

  function direction(clientX, clientY, into) {
    const c = centre();
    const dx = clientX - c.x;
    const dy = clientY - c.y;
    const len = Math.hypot(dx, dy) || 1;
    const strength = Math.min(len / 200, 1);
    into.x = (dx / len) * strength;
    into.y = (dy / len) * strength;
    return into;
  }

  // A quick look at the blob (after a jolt, or out of nerves).
  function glance(seconds = 0.45) {
    glanceUntil = performance.now() / 1000 + seconds;
    glanceJitter.x = (Math.random() - 0.5) * 0.3;
    glanceJitter.y = (Math.random() - 0.5) * 0.3;
  }

  function setVisible(visible) {
    eyes.style.visibility = visible ? '' : 'hidden';
  }

  function setFollow(follow) {
    if (!follow) pointerActive = false;
  }

  function blink() {
    gsap.to(lids, { scaleY: 0.08, duration: 0.07, yoyo: true, repeat: 1, ease: 'power2.in' });
  }

  // Nervous eyes blink up to four times as often.
  function scheduleBlink() {
    const calm = 1 - (CONFIG.eyes.mood ? fear * 0.75 : 0);
    const { blinkMin, blinkMax } = CONFIG.eyes;
    gsap.delayedCall(gsap.utils.random(blinkMin, Math.max(blinkMin, blinkMax)) * calm, () => {
      if (CONFIG.eyes.blink && CONFIG.eyes.visible) blink();
      scheduleBlink();
    });
  }

  if (!reducedMotion) {
    window.addEventListener('pointermove', (event) => {
      if (!CONFIG.eyes.follow) return;
      pointerActive = true;
      direction(event.clientX, event.clientY, cursorLook);
      clearTimeout(pointerTimer);
      pointerTimer = setTimeout(() => {
        pointerActive = false;
      }, 2500);
    });
    scheduleBlink();
  }

  function update(dt) {
    if (!CONFIG.eyes.visible || reducedMotion) return;
    const now = performance.now() / 1000;
    const blob = blobScreen();

    // Fear: how close the blob's edge is, relative to the smaller screen side.
    let fearTarget = 0;
    if (CONFIG.eyes.mood) {
      const c = centre();
      const edge = Math.max(Math.hypot(c.x - blob.x, c.y - blob.y) - blob.r, 0);
      fearTarget = Math.min(Math.max(1 - edge / (0.55 * Math.min(window.innerWidth, window.innerHeight)), 0), 1);
    }
    fear += (fearTarget - fear) * (1 - Math.exp(-dt * 3));

    // Nervous eyes keep checking on the blob.
    if (fear > 0.25 && now > glanceUntil + 0.3 && Math.random() < fear * dt * 1.2) glance(0.35);

    if (now < glanceUntil || !pointerActive || !CONFIG.eyes.follow) {
      direction(blob.x, blob.y, look);
      look.x += now < glanceUntil ? glanceJitter.x : 0;
      look.y += now < glanceUntil ? glanceJitter.y : 0;
    } else {
      look.x = cursorLook.x;
      look.y = cursorLook.y;
    }

    // Frame-rate independent easing; fear makes the eyes dart.
    const k = 1 - Math.exp(-dt * (10 + 20 * fear));
    pupilPos.x += (look.x * CONFIG.eyes.reach - pupilPos.x) * k;
    pupilPos.y += (look.y * CONFIG.eyes.reach - pupilPos.y) * k;
    pupilGroup.setAttribute('transform', `translate(${pupilPos.x.toFixed(2)} ${pupilPos.y.toFixed(2)})`);

    // Wide eyes, small pupils.
    const r = (PUPIL_RADIUS * (1 - 0.4 * fear)).toFixed(2);
    pupils.forEach((pupil) => pupil.setAttribute('r', r));
    eyes.style.transform = fear > 0.01 ? `scale(${(1 + 0.18 * fear).toFixed(3)})` : '';
  }

  return { update, glance, blink, setVisible, setFollow };
}
