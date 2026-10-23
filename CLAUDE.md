# simonnirnberger

Static portfolio of the artist Simon Ernst Nirnberger (drawing, painting) plus a page with short
excerpts from his novel "Aeternus Somnus". No build step, no libraries, no external fonts/hosts.
Served by nginx-unprivileged in Docker, deployed via GitHub Actions → Coolify. Texts are German.

## Layout
- `site/` is shipped as is: `index.html`+`styles.css`+`app.js` (portfolio, gallery, viewer, scroll hero),
  `roman.html|css|js` (novel page, independent styling), `dreamcast.html|css|js` (entry sequence + dreamscape nav at `/dreamcast`), `404.html|css`, `artworks.json`, `assets/`
- `nginx/default.conf` port 8080, CSP (`'self'` only), caching, `/healthz`, `/dreamcast` route
- `docs/dreamcast-konzept.md` design concept for the Dreamcast page (book refs pp. 34, 92, 174–175)
- `Dockerfile`, `docker-compose.yml` hardened runtime (read-only, cap_drop ALL, limits)
- `scripts/` `preview.mjs`, `check-site-files.sh`, `coolify-deploy.sh`
- `.github/workflows/ci.yml` checks, image build + browser tests; on `main` publish + deploy

## Commands
- Preview (same headers/CSP as nginx): `node scripts/preview.mjs 8080`, then http://localhost:8080
- Check references and quotes: `bash scripts/check-site-files.sh`
- Image: `docker build -t simonnirnberger .` (Docker is usually not available in the sandbox; CI does it)
- Deploy: automatic on merge to `main`. Never run `coolify-deploy.sh` by hand.

## Conventions
- Works exist twice and must stay in sync: `works` at the top of `site/app.js` and `site/artworks.json`
  (plus `<noscript>` links in `index.html`).
- Novel excerpts: 14 sentences as `<li class="fragment">` in `roman.html`. The `fragment` field of a work
  (app.js + artworks.json) repeats the sentence verbatim; the check script verifies it.
  Only short excerpts, never the whole book. The book PDF stays out of the repo.
- A replaced image gets a new file name (images are cached for a week). WebP only.
- No inline scripts/styles from other hosts, no requests to other hosts (CSP).
- Respect `prefers-reduced-motion`: all works must stay visible without the scroll sequence.

## Pitfalls
- Mobile hero: the media query in `styles.css` must not set `.hero-art` width/height; it overrides
  `--art-width/--art-height` and breaks the zoom on scroll.
- Dreamcast page: no inline styles (CSP); set styles from JS via CSSOM only. Needs `/dreamcast` in nginx + `scripts/preview.mjs`.
- `/roman` without `.html` needs `try_files $uri $uri.html` in nginx (not done; links use `roman.html`).
- `pkill -f "<pattern>"` in the Bash tool kills its own shell if the pattern appears in the command.

## Open
- Placeholder titles ("Werk 01"), curation sentences, real bio, contact, imprint (Austrian law).
- Final domain: `canonical`/`og:url`/`og:image` point to https://simonernstnirnberger.at/.
- Styling of the novel page is still to come (owner's call).
