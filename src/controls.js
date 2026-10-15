// Tuning panel for the blob, shown at /#controls (loaded on demand by main.js).
// Changes are kept in this browser (localStorage) so a reload keeps them.
// "Exportieren" downloads them as JSON ("Importieren" loads such a file back),
// "Werte kopieren" puts the same JSON on the clipboard to paste into CONFIG in main.js.
import GUI from 'lil-gui';
import 'lil-gui/style.css';
import './controls.css';

const STORAGE_KEY = 'blob-controls';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function save(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Private mode or blocked storage: the panel still works, it just forgets.
  }
}

function forget() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // see save()
  }
}

// Copies known keys only, so an old or hand-edited saved state can't add junk.
function assign(target, source) {
  if (!source || typeof source !== 'object') return;
  for (const key of Object.keys(target)) {
    if (!(key in source)) continue;
    if (typeof target[key] === 'object' && target[key] !== null) assign(target[key], source[key]);
    else if (typeof source[key] === typeof target[key]) target[key] = source[key];
  }
}

export function createControls(hooks) {
  const { CONFIG, DEFAULTS } = hooks;
  function applyAll() {
    hooks.applyColors();
    hooks.syncUniforms();
    hooks.rebuildGeometry();
    if (!CONFIG.quality.auto) hooks.setQuality(CONFIG.quality.level);
    hooks.relayout();
    hooks.setEyesVisible(CONFIG.eyes.visible);
    hooks.setFollow(CONFIG.eyes.follow);
  }

  assign(CONFIG, load());
  applyAll();

  const gui = new GUI({ title: 'Blob', injectStyles: false, width: 300 });
  gui.domElement.classList.add('blob-controls');
  // Buttons report their function as value; they change nothing worth saving.
  gui.onChange(({ value }) => {
    if (typeof value !== 'function') save(CONFIG);
  });

  // --- Farben ---------------------------------------------------------------
  const colors = gui.addFolder('Farben');
  colors.addColor(CONFIG, 'paper').name('Papier').onChange(hooks.applyColors);
  colors.addColor(CONFIG, 'ink').name('Tinte').onChange(hooks.applyColors);

  // --- Form -----------------------------------------------------------------
  const shape = gui.addFolder('Form');
  shape.add(CONFIG.shape, 'noiseFreq', 0.2, 8, 0.05).name('Klumpen (Frequenz)').onChange(hooks.syncUniforms);
  shape.add(CONFIG.shape, 'noiseSpeed', 0, 3, 0.01).name('Fließtempo');
  shape.add(CONFIG.shape, 'energyStart', 0, 0.8, 0.005).name('Unruhe oben').onChange(hooks.relayout);
  shape.add(CONFIG.shape, 'energyEnd', 0, 0.8, 0.005).name('Unruhe unten').onChange(hooks.relayout);
  shape.add(CONFIG.shape, 'rotationSpeed', -1, 1, 0.005).name('Drehung');
  shape
    .add(CONFIG.shape, 'detail', { 'grob (16)': 16, 'mittel (48)': 48, 'fein (96)': 96, 'sehr fein (128)': 128, 'maximal (192)': 192 })
    .name('Geometrie-Detail (max.)')
    .onChange(hooks.rebuildGeometry);

  // --- Tinte & Strich ---------------------------------------------------------
  const look = gui.addFolder('Tinte & Strich');
  look.add(CONFIG.look, 'handmade').name('Handgemacht').onChange(hooks.syncUniforms);
  look.add(CONFIG.look, 'roughness', 0, 12, 0.1).name('Ausfransen (px)').onChange(hooks.syncUniforms);
  look.add(CONFIG.look, 'roughScale', 1, 60, 0.5).name('Fransen-Größe (px)').onChange(hooks.syncUniforms);
  look.add(CONFIG.look, 'mottle', 0, 0.4, 0.005).name('Fleckige Tinte').onChange(hooks.syncUniforms);
  look.add(CONFIG.look, 'boil').name('Zeichentrick-Zittern');
  look.add(CONFIG.look, 'boilFps', 2, 30, 1).name('Zeichnungen pro Sekunde');

  // --- Reaktion auf den Cursor ------------------------------------------------
  const react = gui.addFolder('Reaktion');
  react
    .add(CONFIG.react, 'mode', { Anziehen: 'attract', Zurückweichen: 'flinch', Aus: 'off' })
    .name('Verhalten');
  react.add(CONFIG.react, 'strength', 0, 1.2, 0.01).name('Stärke');
  react.add(CONFIG.react, 'range', 0.05, 1.5, 0.01).name('Reichweite');
  react.add(CONFIG.react, 'sharpness', 0.5, 12, 0.1).name('Spitz ↔ breit').onChange(hooks.syncUniforms);
  react.add(CONFIG.react, 'click').name('Zuckt bei Klick');

  // --- Zucken ---------------------------------------------------------------
  const jolts = gui.addFolder('Zucken');
  jolts.add(CONFIG.jolt, 'enabled').name('An');
  jolts.add(CONFIG.jolt, 'amount', 0, 1.5, 0.01).name('Stärke');
  jolts.add(CONFIG.jolt, 'decay', 0.05, 3, 0.01).name('Abklingen (s)');
  jolts.add(CONFIG.jolt, 'minDelay', 0.05, 10, 0.05).name('Pause min (s)');
  jolts.add(CONFIG.jolt, 'maxDelay', 0.05, 20, 0.05).name('Pause max (s)');
  jolts.add(CONFIG.jolt, 'timeKick', 0, 1, 0.005).name('Sprung');
  jolts.add(CONFIG.shape, 'crackleFreq', 0.5, 20, 0.1).name('Zacken (Frequenz)').onChange(hooks.syncUniforms);
  jolts.add(CONFIG.shape, 'crackleAmount', 0, 2, 0.01).name('Zacken (Stärke)').onChange(hooks.syncUniforms);
  jolts.add({ jolt: hooks.jolt }, 'jolt').name('Jetzt zucken');

  // --- Größe & Position -------------------------------------------------------
  const layout = gui.addFolder('Größe & Position');
  layout.add(CONFIG.layout, 'startSize', 0.05, 1.2, 0.005).name('Größe oben').onChange(hooks.relayout);
  layout.add(CONFIG.layout, 'startX', -1, 1, 0.005).name('Position oben (x)').onChange(hooks.relayout);
  layout.add(CONFIG.layout, 'endCover', 0.3, 2, 0.01).name('Größe unten').onChange(hooks.relayout);

  // --- Scroll ----------------------------------------------------------------
  const scroll = gui.addFolder('Scroll');
  scroll.add(CONFIG.scroll, 'lerp', 0.01, 1, 0.005).name('Trägheit (Lenis)').onChange(hooks.syncUniforms);
  scroll.add(CONFIG.scroll, 'override').name('Fortschritt manuell');
  scroll.add(CONFIG.scroll, 'progress', 0, 1, 0.001).name('Fortschritt');

  // --- Bewegung ----------------------------------------------------------------
  const motion = gui.addFolder('Bewegung');
  motion.add(CONFIG.motion, 'paused').name('Pause');
  motion.add(CONFIG.motion, 'timeScale', 0, 4, 0.01).name('Tempo');
  motion.add(CONFIG, 'grain', 0, 0.3, 0.001).name('Papierkorn').onChange(hooks.syncUniforms);

  // --- Augen -----------------------------------------------------------------
  const eyes = gui.addFolder('Augen');
  eyes.add(CONFIG.eyes, 'visible').name('Sichtbar').onChange(hooks.setEyesVisible);
  eyes.add(CONFIG.eyes, 'follow').name('Folgen dem Cursor').onChange(hooks.setFollow);
  eyes.add(CONFIG.eyes, 'reach', 0, 6, 0.05).name('Blickweite');
  eyes.add(CONFIG.eyes, 'blink').name('Blinzeln');
  eyes.add(CONFIG.eyes, 'blinkMin', 0.2, 15, 0.1).name('Blinzeln min (s)');
  eyes.add(CONFIG.eyes, 'blinkMax', 0.2, 30, 0.1).name('Blinzeln max (s)');
  eyes.add(CONFIG.eyes, 'mood').name('Werden nervös');
  eyes.add(CONFIG.eyes, 'lastLight').name('Bleiben am Ende übrig');
  eyes.add({ blink: hooks.blink }, 'blink').name('Jetzt blinzeln');

  // --- Qualität ---------------------------------------------------------------
  const quality = gui.addFolder('Qualität');
  const levels = Object.fromEntries(hooks.QUALITY_LEVELS.map((level, i) => [level.name, i]));
  const levelControl = quality
    .add(CONFIG.quality, 'level', levels)
    .name('Stufe (manuell)')
    .onChange((level) => hooks.setQuality(level));
  quality
    .add(CONFIG.quality, 'auto')
    .name('Automatisch')
    .onChange((auto) => {
      levelControl.enable(!auto);
      if (!auto) hooks.setQuality(CONFIG.quality.level);
    });
  levelControl.enable(!CONFIG.quality.auto);
  quality.add(hooks.quality, 'level').name('Aktuell').listen().disable();
  quality.add(hooks.quality, 'fps').name('Bilder/s').decimals(0).listen().disable();
  if (!hooks.hasWebGL) quality.domElement.dataset.note = 'Kein WebGL: statischer Blob';

  // --- Werte -------------------------------------------------------------------
  // Briefly shows a status on a button, then restores its label.
  function flash(controller, label, status) {
    controller.name(status);
    setTimeout(() => controller.name(label), 2000);
  }

  function applyImported(data) {
    assign(CONFIG, data);
    save(CONFIG);
    applyAll();
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  }

  const actions = {
    exportFile: () => {
      const json = JSON.stringify(CONFIG, null, 2);
      const url = URL.createObjectURL(new Blob([json + '\n'], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `blob-config-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash(exportButton, 'Exportieren (JSON)', 'Exportiert ✓');
    },
    importFile: () => {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = 'application/json,.json';
      picker.addEventListener('change', async () => {
        const file = picker.files?.[0];
        if (!file) return;
        try {
          applyImported(JSON.parse(await file.text()));
          flash(importButton, 'Importieren (JSON)', 'Importiert ✓');
        } catch {
          flash(importButton, 'Importieren (JSON)', 'Keine gültige Datei ✗');
        }
      });
      picker.click();
    },
    copy: async () => {
      const json = JSON.stringify(CONFIG, null, 2);
      try {
        await navigator.clipboard.writeText(json);
        flash(copyButton, 'Werte kopieren', 'Kopiert ✓');
      } catch {
        console.log(json);
        flash(copyButton, 'Werte kopieren', 'In der Konsole ✓');
      }
    },
    reset: () => {
      assign(CONFIG, structuredClone(DEFAULTS));
      forget();
      applyAll();
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
    close: () => {
      // Drops "#controls" without adding a history entry or jumping.
      history.replaceState(null, '', window.location.pathname + window.location.search);
      gui.hide();
    },
  };
  const exportButton = gui.add(actions, 'exportFile').name('Exportieren (JSON)');
  const importButton = gui.add(actions, 'importFile').name('Importieren (JSON)');
  const copyButton = gui.add(actions, 'copy').name('Werte kopieren');
  gui.add(actions, 'reset').name('Zurücksetzen');
  gui.add(actions, 'close').name('Schließen');

  if (hooks.reducedMotion) {
    gui.domElement.dataset.note = 'prefers-reduced-motion: Bewegung ist aus';
  }

  // Start compact on small screens.
  if (window.matchMedia('(max-width: 768px)').matches) gui.close();
  else [shape, look, react, jolts, layout, scroll, motion, eyes, quality].forEach((f) => f.close());

  return {
    setVisible(visible) {
      gui.show(visible);
    },
  };
}
