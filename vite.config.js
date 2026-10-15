import { readFileSync } from 'node:fs';
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

export default defineConfig({
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
