import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// `vite preview` sends the same security headers as nginx, so CSP problems
// show up locally before they show up in production.
function nginxHeaders() {
  try {
    const conf = readFileSync(new URL('./nginx/default.conf', import.meta.url), 'utf8');
    const headers = {};
    for (const [, name, value] of conf.matchAll(/^\s*add_header\s+(\S+)\s+"([^"]*)"\s+always;/gm)) {
      headers[name] = value;
    }
    return headers;
  } catch {
    return {};
  }
}

// lil-gui's stylesheet embeds its icon font as a data: URI, which the CSP
// (`default-src 'self'`) blocks. The icons are plain characters (▾ ✓ ↕), so
// dropping the @font-face lets the browser draw them with a system font.
const lilGuiWithoutDataFont = {
  name: 'lil-gui-without-data-font',
  transform(code, id) {
    if (!id.endsWith('lil-gui/dist/lil-gui.css')) return null;
    return { code: code.replace(/@font-face\s*{[^}]*}/g, ''), map: null };
  },
};

export default defineConfig({
  plugins: [lilGuiWithoutDataFont],
  resolve: {
    alias: {
      // lil-gui doesn't export its stylesheet; bundling it keeps the CSP strict
      // (its default is to inject a <style> tag, which `style-src 'self'` blocks).
      'lil-gui/style.css': fileURLToPath(new URL('./node_modules/lil-gui/dist/lil-gui.css', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    // Never inline assets as data: URIs; everything stays a file under /assets/.
    assetsInlineLimit: 0,
    // three.js alone is ~600 kB (≈190 kB gzip); one chunk is fine here.
    chunkSizeWarningLimit: 800,
  },
  preview: {
    headers: nginxHeaders(),
  },
});
