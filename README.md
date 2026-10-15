# simonnirnberger

Statische Webseite, ausgeliefert per nginx in einem Docker-Container mit minimalen Rechten.
Gedacht für das Deployment über [Coolify](https://coolify.io).

## Struktur

```
.
├── Dockerfile          # Baut mit Node (Vite), liefert dist/ mit nginx-unprivileged aus (UID 101)
├── docker-compose.yml  # Laufzeit-Härtung (read-only, keine Capabilities, Limits)
├── .dockerignore       # Nur Dockerfile, nginx/ und die Vite-Quellen landen im Build-Kontext
├── nginx/
│   └── default.conf    # Server-Konfiguration: Port 8080, Security-Header, /healthz
├── index.html, src/    # Die Landingpage (Vite + Three.js)
└── public/             # Statische Dateien, unverändert kopiert (favicon, 404-Seite)
```

## Least Privilege

| Maßnahme | Wo |
| --- | --- |
| Prozess läuft als Nicht-Root-User (UID 101) | `Dockerfile`, `docker-compose.yml` |
| Unprivilegierter Port 8080 | `Dockerfile`, `nginx/default.conf` |
| Webinhalte gehören root, für nginx nur lesbar | `Dockerfile` |
| Read-only Root-Dateisystem, nur `/tmp` als tmpfs (`noexec`) | `docker-compose.yml` |
| Alle Linux-Capabilities entfernt | `docker-compose.yml` (`cap_drop: ALL`) |
| Keine Rechteausweitung (`no-new-privileges`) | `docker-compose.yml` |
| Limits für Speicher, CPU und Prozesse | `docker-compose.yml` |
| Kein Port auf dem Host veröffentlicht, nur `expose` für Coolifys Proxy | `docker-compose.yml` |
| Keine Versionsangabe, versteckte Dateien gesperrt, Security-Header | `nginx/default.conf` |

## Lokal testen

```sh
npm install && npm run dev          # Entwicklung: http://localhost:5173
docker build -t simonnirnberger .   # Produktions-Image
docker run --rm -p 8080:8080 --read-only --tmpfs /tmp simonnirnberger
# http://localhost:8080, http://localhost:8080/healthz, http://localhost:8080/version.txt
```

## Deployment (GitHub Actions → Coolify)

Coolify baut nicht selbst. `.github/workflows/ci.yml` macht bei jedem Push und PR:

1. **Seite bauen** (`npm ci`, `npm run build`, keine externen URLs).
2. **Docker-Image** bauen und im gehärteten Container testen: Seite, Assets, 404, CSP-Header,
   `/version.txt` = Commit, nginx als UID 101.

Nur auf `main` danach:

3. **Image veröffentlichen**: genau das getestete Image nach
   `ghcr.io/seitenschwung/simonnirnberger:<commit>` (und `:main`).
4. **Deploy**: Der Runner tritt per Tailscale dem Tailnet bei, `scripts/coolify-deploy.sh` setzt in
   Coolify `IMAGE_TAG=<commit>`, startet den Deploy, wartet, bis `APP_URL/version.txt` genau diesen
   Commit zeigt, und prüft Seite, Assets, `/healthz` und 404. Schlägt das fehl, wird automatisch die
   vorher laufende Version wieder ausgerollt.

**Einrichtung (einmalig)**

- GitHub, *Settings → Secrets and variables → Actions*:
  - Secrets (oder Org-Secrets): `COOLIFY_URL`, `COOLIFY_TOKEN`, `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`
  - Variablen: `COOLIFY_APP_UUID` (aus der Coolify-Adresse, Teil hinter `/application/`),
    `APP_URL` (z. B. `https://simonnirnberger.de`)
- Coolify-Ressource: **Build Pack Docker Compose** aus diesem Repo (`docker-compose.yml`),
  Domain beim Service `web` mit Port 8080 (`https://…:8080`), Umgebungsvariable `IMAGE_TAG=main`,
  **Auto Deploy aus** (das übernimmt die Pipeline).
- Der Server braucht Lesezugriff auf die Registry: `docker login ghcr.io` mit einem Token mit
  `read:packages` (einmal, gilt für alle Pakete der Organisation).
