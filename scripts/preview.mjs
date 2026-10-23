// Local preview of site/ without Docker: same security headers as nginx/default.conf
// (so CSP problems show up here first), same 404 page, /healthz and /version.txt.
//   node scripts/preview.mjs [port]      (default 8080, listens on 0.0.0.0)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../site/', import.meta.url).pathname;
const port = Number(process.argv[2] || 8080);

const conf = await readFile(new URL('../nginx/default.conf', import.meta.url), 'utf8');
const headers = Object.fromEntries(
  [...conf.matchAll(/^\s*add_header\s+(\S+)\s+"([^"]*)"\s+always;/gm)].map(([, name, value]) => [name, value]),
);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
};

async function file(path) {
  const full = normalize(join(root, path));
  if (!full.startsWith(root) || path.split('/').some((part) => part.startsWith('.'))) return null;
  try {
    const info = await stat(full);
    return info.isDirectory() ? file(join(path, 'index.html')) : { body: await readFile(full), type: types[extname(full)] };
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/healthz') return res.writeHead(200, { ...headers, 'Content-Type': 'text/plain' }).end('ok\n');
  if (path === '/version.txt') return res.writeHead(200, { ...headers, 'Content-Type': 'text/plain' }).end('preview\n');
  if (path === '/dreamcast/') return res.writeHead(301, { ...headers, Location: '/dreamcast' }).end();
  const found = await file(path === '/dreamcast' ? '/dreamcast.html' : path);
  if (found) return res.writeHead(200, { ...headers, 'Content-Type': found.type || 'application/octet-stream' }).end(found.body);
  const notFound = await file('/404.html');
  res.writeHead(404, { ...headers, 'Content-Type': types['.html'] }).end(notFound?.body ?? 'Not found');
}).listen(port, '0.0.0.0', () => console.log(`site/ on http://localhost:${port} (nginx headers, CSP on)`));
