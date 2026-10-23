// Glasbaum: Kristallbaum als 3D-Projektion auf einem 2D-Canvas (keine Bibliotheken, CSP-konform).
// Scrollen und Ziehen drehen den Baum, der Zeiger lenkt Licht und Neigung. Die hellen Blätter öffnen Fragmente.
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#tree');
  const ctx = canvas.getContext('2d');
  const stage = $('#stage');
  const card = $('#card');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const frags = [...document.querySelectorAll('#frags li')].map((li) => ({
    kind: li.dataset.kind,
    text: li.querySelector('blockquote').textContent,
    page: li.querySelector('cite').textContent,
  }));

  /* ---------- Baum erzeugen (fester Startwert, damit er immer gleich aussieht) ---------- */
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // Vektor d um den Winkel ang Richtung einer zufälligen Querachse kippen
  const tilt = (d, ang, az) => {
    const u = norm(cross(d, Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
    const v = cross(d, u);
    const side = add(u, v, 0); // Kopie
    const dir = add(add(side, u, Math.cos(az)), v, Math.sin(az));
    return norm(add(d, norm(dir), Math.tan(ang)));
  };

  const segs = []; // { a, b, w, kind }
  const leaves = []; // { p: [4 Punkte], n, c, hue, frag }

  const leafAt = (p, d, size) => {
    const s = norm(cross(d, [rnd() - .5, rnd() - .5, rnd() - .5]));
    const w = size * .3;
    const base = p, tip = add(p, d, size), mid = add(p, d, size * .38);
    leaves.push({ p: [base, add(mid, s, w), tip, add(mid, s, -w)], n: norm(cross(d, s)), c: add(p, d, size * .5), h: rnd() * 360, frag: -1, size });
  };

  const grow = (o, d, len, depth, max) => {
    const e = add(o, d, len);
    segs.push({ a: o, b: e, w: Math.max(.5, depth === 0 ? 9 : (max - depth) * 1.6 + .6), kind: 'steel' });
    if (depth >= 3) for (let i = 0; i < 2; i++) leafAt(e, tilt(d, .6 + rnd() * .8, rnd() * 6.28), len * (.9 + rnd() * .5));
    if (depth >= max) return;
    const n = depth < 2 ? 3 : 2 + (rnd() < .35 ? 1 : 0);
    const az0 = rnd() * 6.28;
    for (let i = 0; i < n; i++) grow(e, tilt(d, .38 + rnd() * .3, az0 + (i * 6.28) / n + rnd() * .5), len * (.7 + rnd() * .08), depth + 1, max);
  };
  const root = (o, d, len, depth) => {
    const e = add(o, d, len);
    segs.push({ a: o, b: e, w: Math.max(.5, (3 - depth) * 2.4), kind: 'root' });
    if (depth >= 3) return;
    for (let i = 0; i < 2; i++) root(e, norm(add(tilt(d, .55 + rnd() * .4, rnd() * 6.28), [0, -.15, 0])), len * .72, depth + 1);
  };

  grow([0, 0, 0], [0, 1, 0], .62, 0, 6);
  for (let i = 0; i < 5; i++) root([0, 0, 0], norm(add(tilt([0, -1, 0], .85, (i * 6.28) / 5 + rnd() * .4), [0, 0, 0])), .5, 1);

  // Fragmente auf Blätter in der Krone verteilen: nach Drehwinkel sortiert, gleichmäßig gewählt
  const crown = leaves.filter((l) => l.c[1] > 1.2).sort((a, b) => Math.atan2(a.c[2], a.c[0]) - Math.atan2(b.c[2], b.c[0]));
  frags.forEach((_, i) => { const l = crown[Math.floor(((i + .5) * crown.length) / frags.length)]; l.frag = i; l.size *= 1.45; l.p = l.p.map((q) => add(l.c, add(q, l.c, -1), 1.45)); });
  const marked = leaves.filter((l) => l.frag >= 0);

  let top = 0, bottom = 0;
  segs.forEach((s) => { top = Math.max(top, s.b[1]); bottom = Math.min(bottom, s.b[1]); });
  leaves.forEach((l) => l.p.forEach((q) => { top = Math.max(top, q[1]); }));
  const midY = (top + bottom) / 2;

  /* ---------- Zustand und Eingaben ---------- */
  let W = 0, H = 0, dpr = 1;
  let drag = 0, auto = 0, wantDrag = 0;
  const light = { x: -.5, y: .6, tx: -.5, ty: .6 };
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  let hot = null, active = -1, shown = -1;
  let down = null, moved = 0, last = performance.now(), dirty = true, inView = true;

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    dirty = true;
  };
  const progress = () => {
    const r = stage.getBoundingClientRect();
    return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
  };
  const rel = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = rel(e);
    light.tx = (x / W - .5) * 2; light.ty = -(y / H - .5) * 2;
    look.tx = light.tx; look.ty = light.ty;
    if (down) {
      const dx = e.clientX - down.x;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(e.clientY - down.y));
      wantDrag = down.drag + dx * .008;
      canvas.classList.add('is-drag');
    } else {
      hot = pick(x, y);
      canvas.classList.toggle('is-hot', !!hot);
    }
    dirty = true;
  });
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, drag: wantDrag };
    moved = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  const release = (e) => {
    if (!down) return;
    const wasTap = moved < 6 && e.type === 'pointerup';
    down = null;
    canvas.classList.remove('is-drag');
    if (wasTap) { const [x, y] = rel(e); const l = pick(x, y); if (l) show(l.frag); }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { if (!down) { hot = null; canvas.classList.remove('is-hot'); light.tx = -.5; light.ty = .6; look.tx = look.ty = 0; dirty = true; } });
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  addEventListener('resize', resize);
  new IntersectionObserver(([en]) => { inView = en.isIntersecting; dirty = true; }).observe(stage);

  const show = (i) => {
    shown = active = ((i % frags.length) + frags.length) % frags.length;
    const f = frags[shown];
    $('#card-kind').textContent = f.kind;
    $('#card-quote').textContent = f.text;
    $('#card-page').textContent = f.page;
    card.hidden = false;
    dirty = true;
  };
  $('#card-close').addEventListener('click', () => { card.hidden = true; active = -1; dirty = true; });
  $('#next').addEventListener('click', () => show(shown + 1));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !card.hidden) { card.hidden = true; active = -1; dirty = true; } });

  /* ---------- Projektion ---------- */
  let cy = 1, sy = 0, cp = 1, sp = 0, scale = 1, cam = 5;
  const view = (q) => {
    const x = q[0], y = q[1] - midY, z = q[2];
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    const f = cam / (cam + z2);
    return [W * (W < 700 ? .5 : .6) + x1 * f * scale, H * (W < 700 ? .6 : .5) - y2 * f * scale, z2, x1, y2];
  };
  const rotN = (n) => {
    const x1 = n[0] * cy + n[2] * sy, z1 = -n[0] * sy + n[2] * cy;
    return [x1, n[1] * cp - z1 * sp, n[1] * sp + z1 * cp];
  };

  let order = [];
  const inside = (pts, x, y) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  // Treffer nur auf Blättern mit Fragment, die vorderen zuerst; kleine Toleranz für Finger und Maus
  function pick(x, y) {
    let best = null, bd = 1e9;
    for (const l of marked) {
      if (!l.s) continue;
      const cx = (l.s[0][0] + l.s[2][0]) / 2, cyy = (l.s[0][1] + l.s[2][1]) / 2;
      const d = Math.hypot(cx - x, cyy - y), r = Math.max(14, Math.hypot(l.s[0][0] - l.s[2][0], l.s[0][1] - l.s[2][1]) * .55);
      if ((inside(l.s, x, y) || d < r) && l.s[0][2] < bd) { best = l; bd = l.s[0][2]; }
    }
    return best;
  }

  /* ---------- Zeichnen ---------- */
  const draw = (t) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    light.x += (light.tx - light.x) * .08; light.y += (light.ty - light.y) * .08;
    look.x += (look.tx - look.x) * .06; look.y += (look.ty - look.y) * .06;
    drag += (wantDrag - drag) * .12;

    const yaw = progress() * Math.PI * 2 + drag + auto;
    const pitch = .16 + look.y * .12;
    const yawJ = yaw + look.x * .18;
    cy = Math.cos(yawJ); sy = Math.sin(yawJ); cp = Math.cos(pitch); sp = Math.sin(pitch);
    scale = Math.min(H / (top - bottom) * (W < 700 ? .58 : .78), W * (W < 700 ? .8 : .62) / 2.4);
    const L = norm([light.x, light.y, .9]);

    // Boden: ein Schatten aus Licht, damit der Baum nicht schwebt
    const g = view([0, 0, 0]);
    ctx.fillStyle = 'rgba(35,33,31,.07)';
    ctx.beginPath(); ctx.ellipse(g[0], g[1], scale * .7, scale * .12, 0, 0, 7); ctx.fill();

    const items = [];
    for (const s of segs) { const a = view(s.a), b = view(s.b); items.push({ z: (a[2] + b[2]) / 2, s, a, b }); }
    for (const l of leaves) { const p = l.p.map(view); l.s = p; items.push({ z: (p[0][2] + p[2][2]) / 2, l, p }); }
    items.sort((a, b) => b.z - a.z);

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const it of items) {
      if (it.s) {
        const f = cam / (cam + it.z);
        ctx.lineWidth = Math.max(.6, it.s.w * f * (scale / 300));
        ctx.strokeStyle = it.s.kind === 'steel' ? '#2d4f7c' : '#7f858c';
        ctx.beginPath(); ctx.moveTo(it.a[0], it.a[1]); ctx.lineTo(it.b[0], it.b[1]); ctx.stroke();
        continue;
      }
      const l = it.l, n = rotN(l.n);
      const ndl = Math.abs(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      const spec = Math.pow(ndl, 14);
      const hue = (l.h + ndl * 260 + yaw * 30) % 360;
      const isMarked = l.frag >= 0, isHot = l === hot, isOn = l.frag === active;
      const a = (isMarked ? .62 : .14) + spec * .3 + (isHot || isOn ? .2 : 0);
      ctx.beginPath();
      it.p.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue},75%,${isMarked ? 52 : 62}%,${Math.min(.95, a)})`;
      ctx.fill();
      // Kante und Glanzlicht: Kristall, nicht Blatt
      ctx.strokeStyle = isHot || isOn ? 'rgba(35,33,31,.95)' : `hsla(${hue},60%,38%,${isMarked ? .8 : .22})`;
      ctx.lineWidth = isHot || isOn ? 1.6 : .7;
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(it.p[0][0], it.p[0][1]); ctx.lineTo(it.p[2][0], it.p[2][1]);
      ctx.strokeStyle = `rgba(255,255,255,${.25 + spec * .6})`; ctx.lineWidth = .8; ctx.stroke();
    }
  };

  const frame = (now) => {
    const dt = Math.min(64, now - last); last = now;
    if (!reduce.matches && inView && !down) { auto += dt * .00006; dirty = true; }
    if (dirty && inView && !document.hidden) {
      dirty = false;
      draw(now);
      // beim Ausklingen der Glättung weiterzeichnen
      if (Math.abs(light.tx - light.x) + Math.abs(light.ty - light.y) + Math.abs(look.tx - look.x) + Math.abs(look.ty - look.y) + Math.abs(wantDrag - drag) > .002) dirty = true;
    }
    requestAnimationFrame(frame);
  };

  resize();
  requestAnimationFrame(frame);
})();
