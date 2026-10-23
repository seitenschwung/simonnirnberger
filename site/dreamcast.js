/* Dreamcast: Einstieg (Papier -> Tank -> Wasser -> Verzerrung -> Traumwelt) und die Traumwelt als Navigation. */
(() => {
  const body = document.body;
  const $ = (s) => document.querySelector(s);
  const wake = $('#wake'), dream = $('#dream'), enterBtn = $('#einsteigen'), plain = $('#enter-plain');
  const status = $('#status'), whisper = $('#whisper'), warning = $('#warning'), clock = $('#dream-clock');
  const discsEl = $('#discs'), canvas = $('#field'), ctx = canvas.getContext('2d');
  const warpMap = $('#warp-map'), warpNoise = $('#warp-noise');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const year = document.querySelectorAll('.year'); year.forEach((el) => { el.textContent = new Date().getFullYear(); });

  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.splice(0).forEach(clearTimeout); };

  const navTargets = [
    { id: 4, label: 'Werke', href: 'index.html#werke' },
    { id: 12, label: 'Roman', href: 'roman.html' },
    { id: 9, label: 'Über mich', href: 'index.html#ueber' },
  ];
  let discs = [];
  let works = [];
  const loaded = fetch('artworks.json').then((r) => r.json()).then((data) => { works = data; }).catch(() => {});

  function buildDiscs() {
    discsEl.replaceChildren();
    discs = [];
    const byId = new Map(works.map((w) => [w.id, w]));
    const make = (href, thumb, label, kind, seed) => {
      const a = document.createElement('a');
      a.className = 'disc' + (kind === 'work' ? ' is-small' : '');
      a.href = href;
      a.setAttribute('aria-label', label);
      const img = document.createElement('img');
      img.className = 'disc-img';
      img.src = thumb;
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      const span = document.createElement('span');
      span.className = 'disc-label';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = label;
      a.append(img, span);
      discsEl.append(a);
      const d = { el: a, kind, seed, depth: kind === 'nav' ? 1 : 0.45 + ((seed * 0.6180339) % 1) * 0.55, a0: 0, size: 0 };
      discs.push(d);
      return d;
    };
    navTargets.forEach((n, i) => {
      const w = byId.get(n.id);
      if (!w) return;
      make(n.href, w.thumbnail, n.label, 'nav', i).a0 = -Math.PI / 2 + (i * Math.PI * 2) / navTargets.length;
    });
    const rest = works.filter((w) => !navTargets.some((n) => n.id === w.id));
    rest.forEach((w, i) => {
      make(`index.html?werk=${String(w.id).padStart(2, '0')}`, w.thumbnail, w.title, 'work', i + 5).a0 = (i * Math.PI * 2) / rest.length;
    });
    discs.forEach((d) => {
      d.el.addEventListener('pointerenter', () => { hovering = true; });
      d.el.addEventListener('pointerleave', () => { hovering = false; });
      d.el.addEventListener('focus', () => { hovering = true; });
      d.el.addEventListener('blur', () => { hovering = false; });
    });
  }

  /* ---------- Layout der Discs und Wellenfeld ---------- */
  let W = 0, H = 0, dpr = 1;
  let speed = 1, hovering = false, spin = 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0 };
  let raf = 0, t0 = 0, running = false;

  function resize() {
    W = innerWidth; H = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ptr.tx = ptr.x = ptr.px = W / 2; ptr.ty = ptr.y = ptr.py = H / 2;
    const small = W < 700;
    const navSize = Math.max(80, Math.min(small ? 88 : 150, Math.min(W, H) * (small ? .24 : .2)));
    discs.forEach((d) => { d.size = d.kind === 'nav' ? navSize : (small ? 34 : 44) + d.depth * (small ? 22 : 38); d.el.style.width = d.el.style.height = `${d.size}px`; });
    if (!running) frame(0);
  }

  function layout(time) {
    const cx = W / 2, cy = H / 2, small = W < 700;
    const ryOut = Math.max(110, Math.min(H * .34, (H - 390) / 2));
    const rxOut = W * (small ? .4 : .42);
    const rxIn = W * (small ? .14 : .19), ryIn = Math.min(ryOut * (small ? .7 : .55), small ? H : H * .2);
    const mx = (ptr.px / W - .5) * 2, my = (ptr.py / H - .5) * 2;
    for (const d of discs) {
      const nav = d.kind === 'nav';
      const a = d.a0 + (nav ? spin * .7 : -spin * 1.0);
      const rx = nav ? rxIn : rxOut * (.86 + .14 * Math.sin(d.seed * 2.3));
      const ry = nav ? ryIn : ryOut * (.86 + .14 * Math.cos(d.seed * 1.7));
      const par = (nav ? 14 : 12 + d.depth * 34);
      const x = cx + Math.cos(a) * rx - mx * par - d.size / 2;
      const y = cy + Math.sin(a) * ry - my * par + Math.sin(time * .6 + d.seed) * 6 - d.size / 2;
      d.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }
  }

  function drawField(time) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = W < 700 ? 26 : 34, rowH = s * .866;
    const cx = W / 2, cy = H / 2;
    for (let r = -1, y = 0; (y = r * rowH) < H + s; r++) {
      const off = r & 1 ? s / 2 : 0;
      for (let x = -s + off; x < W + s; x += s) {
        const dp = Math.hypot(x - ptr.x, y - ptr.y), dc = Math.hypot(x - cx, y - cy);
        const w1 = Math.sin(dp * .028 - time * 1.7) * Math.exp(-dp / 380);
        const w2 = Math.sin(dc * .014 - time * .6) * .5;
        const n = Math.sin(x * .011 + time * .5) * Math.sin(y * .013 - time * .4);
        const k = (w1 * .8 + w2 * .5 + n * .4) * .5 + .5;
        ctx.globalAlpha = .08 + k * .5;
        ctx.fillStyle = '#6fd8d2';
        ctx.beginPath();
        ctx.arc(x, y, .8 + k * 2.1, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const time = now / 1000;
    const dt = Math.min(time - (frame.last ?? time), .1);
    frame.last = time;
    ptr.x += (ptr.tx - ptr.x) * .08; ptr.y += (ptr.ty - ptr.y) * .08;
    ptr.px += (ptr.tx - ptr.px) * .04; ptr.py += (ptr.ty - ptr.py) * .04;
    speed += ((hovering ? 0 : 1) - speed) * .06;
    if (!reduced.matches) spin += dt * .035 * speed;
    drawField(reduced.matches ? 2 : time);
    layout(reduced.matches ? 0 : time);
    if (running) raf = requestAnimationFrame(frame);
  }
  function loopStart() { if (running) return; running = true; frame.last = undefined; raf = requestAnimationFrame(frame); }
  function loopStop() { running = false; cancelAnimationFrame(raf); }

  addEventListener('pointermove', (e) => { ptr.tx = e.clientX; ptr.ty = e.clientY; }, { passive: true });
  addEventListener('resize', () => { if (discs.length) resize(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) loopStop(); else if (body.dataset.phase === 'dream') loopStart(); });

  /* ---------- Einstieg ---------- */
  const lines = [
    [0, 'Neuroverbindung wird hergestellt …'],
    [1000, 'Wassermoleküle ausgerichtet'],
    [2000, 'Frequenz stabil'],
    [3000, 'Disc eingelegt: Dreamscape'],
    [3900, 'Bewusstsein wird übertragen'],
  ];

  function warp(ms) {
    if (reduced.matches) return;
    wake.classList.add('is-warping');
    const t = performance.now();
    (function step(now) {
      const p = Math.min((now - t) / ms, 1);
      const env = Math.sin(p * Math.PI);
      warpMap.setAttribute('scale', String(Math.round(env * 120)));
      warpNoise.setAttribute('baseFrequency', `${(.004 + p * .016).toFixed(4)} ${(.012 + env * .03).toFixed(4)}`);
      if (p < 1) requestAnimationFrame(step);
      else { wake.classList.remove('is-warping'); warpMap.setAttribute('scale', '0'); }
    })(t);
  }

  async function enter() {
    if (body.dataset.phase !== 'wake') return;
    scrollTo(0, 0);
    enterBtn.disabled = true;
    const r = $('#tank').getBoundingClientRect();
    dream.style.setProperty('--cx', `${r.left + r.width / 2}px`);
    dream.style.setProperty('--cy', `${r.top + r.height / 2}px`);
    body.dataset.phase = 'enter';
    await Promise.race([loaded, new Promise((ok) => setTimeout(ok, 1500))]);
    buildDiscs(); resize();
    if (reduced.matches) {
      status.textContent = lines[lines.length - 1][1];
      later(arrive, 300);
      return;
    }
    lines.forEach(([ms, text]) => later(() => { status.textContent = text; }, ms));
    later(() => warp(2600), 1500);
    later(() => { dream.classList.add('is-open'); }, 3600);
    later(arrive, 5900);
  }

  function arrive() {
    dream.classList.add('is-open');
    body.dataset.phase = 'dream';
    wake.inert = true;
    wake.style.visibility = 'hidden';
    dream.inert = false;
    dream.removeAttribute('aria-hidden');
    loopStart();
    startClock();
    startWhispers();
    ($('#discs a') || $('#wake-btn')).focus({ preventScroll: true });
  }

  /* ---------- Aufwachen ---------- */
  function leave() {
    if (body.dataset.phase !== 'dream') return;
    clearTimers(); clearInterval(clockTimer); clearInterval(whisperTimer);
    wake.style.visibility = '';
    wake.inert = false;
    dream.classList.remove('is-open');
    dream.classList.add('is-draining');
    dream.inert = true;
    dream.setAttribute('aria-hidden', 'true');
    whisper.classList.remove('is-on');
    warning.hidden = true;
    later(() => {
      dream.classList.remove('is-draining');
      loopStop();
      body.dataset.phase = 'wake';
      status.textContent = 'Wach.';
      enterBtn.disabled = false;
      enterBtn.focus({ preventScroll: true });
    }, reduced.matches ? 50 : 1500);
  }
  $('#wake-btn').addEventListener('click', leave);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') leave(); });

  /* ---------- Uhr, Zitate, Warnung ---------- */
  let clockTimer = 0, whisperTimer = 0, since = 0;
  function startClock() {
    since = Date.now();
    clock.textContent = '00:00';
    clockTimer = setInterval(() => {
      const s = Math.floor((Date.now() - since) / 1000);
      clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      if (s === 75) warning.hidden = false;
      if (s === 95) warning.hidden = true;
    }, 1000);
  }
  function startWhispers() {
    const quotes = [...document.querySelectorAll('#quotes li')].map((li) => ({ text: li.querySelector('p').textContent, page: li.querySelector('cite').textContent }));
    if (!quotes.length) return;
    let i = 0;
    const show = () => {
      whisper.classList.remove('is-on');
      setTimeout(() => {
        const q = quotes[i++ % quotes.length];
        whisper.textContent = `„${q.text}“`;
        const cite = document.createElement('cite');
        cite.textContent = `Aeternus Somnus · ${q.page}`;
        whisper.append(cite);
        whisper.classList.add('is-on');
      }, reduced.matches ? 0 : 1200);
    };
    show();
    whisperTimer = setInterval(show, 9000);
  }

  /* ---------- Start ---------- */
  plain.hidden = true;
  enterBtn.hidden = false;
  enterBtn.addEventListener('click', enter);
})();
