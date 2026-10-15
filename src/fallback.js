// Static ink blob from index.html. It shows before the first WebGL frame and
// whenever WebGL is missing or lost. Without WebGL it still grows on scroll.
import gsap from 'gsap';

export function createFallback(element) {
  // Layout box without transforms (offset* ignore them), so the scroll tween
  // can measure where it starts no matter how far it has already grown.
  function base() {
    const size = element.offsetWidth;
    return { x: element.offsetLeft + size / 2, y: element.offsetTop + size / 2, size };
  }

  function blobScreen() {
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, r: box.width / 2 };
  }

  function followScroll(scrollTrigger) {
    gsap.to(element, {
      x: () => window.innerWidth / 2 - base().x,
      y: () => window.innerHeight / 2 - base().y,
      scale: () => (Math.hypot(window.innerWidth, window.innerHeight) * 1.1) / base().size,
      ease: 'none',
      scrollTrigger: { ...scrollTrigger, invalidateOnRefresh: true },
    });
  }

  return { blobScreen, followScroll };
}
