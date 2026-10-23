# simonnirnberger

Portfolio von Simon Ernst Nirnberger – Zeichnung und Malerei. Statische Seite ohne Bibliotheken,
Tracking oder externe Fonts, ausgeliefert per nginx in einem Docker-Container mit minimalen Rechten
und über [Coolify](https://coolify.io) deployt.

## Struktur

```
.
├── site/                    # Die Webseite, genau so wie sie ausgeliefert wird
│   ├── index.html           # Struktur, Texte, SEO, Abschnitte
│   ├── styles.css           # Farben, Typografie, Layout, Animationen
│   ├── app.js               # Galerie, Menü, Bildbetrachter, Scroll-Effekte
│   ├── artworks.json        # Metadaten der 13 Werke (Export, siehe unten)
│   ├── 404.html, 404.css    # Fehlerseite
│   └── assets/
│       ├── artworks/        # Werke in voller Auflösung (WebP)
│       ├── thumbs/          # Galerie-Vorschauen (WebP)
│       ├── favicon.svg
│       └── social-preview.jpg
├── nginx/default.conf       # Port 8080, Security-Header (CSP), Caching, /healthz
├── Dockerfile               # nginx-unprivileged (UID 101), kopiert site/
├── docker-compose.yml       # Laufzeit-Härtung (read-only, keine Capabilities, Limits)
└── scripts/
    ├── preview.mjs          # lokale Vorschau mit den nginx-Headern
    ├── check-site-files.sh  # prüft, ob jede verlinkte Datei existiert
    └── coolify-deploy.sh    # Deploy und Smoke-Tests (von der Pipeline aufgerufen)
```

Es gibt keinen Build-Schritt: Was in `site/` liegt, wird ausgeliefert.

## Inhalte pflegen

- **Werke:** Die Liste `works` ganz oben in `site/app.js` steuert die Galerie. `site/artworks.json`
  enthält dieselben Daten als Export: beide synchron halten. Für den Fallback ohne JavaScript auch die
  `<noscript>`-Links in `site/index.html` anpassen.
- **Dreamcast (`/dreamcast`):** Einstiegssequenz (Tank → Wasser → Verzerrung → Traumwelt) und Navigation über
  schwebende „Discs“. Dateien `site/dreamcast.html|css|js`, Konzept in `docs/dreamcast-konzept.md`. Die Zitate mit
  Seitenzahl stehen in `dreamcast.html` und werden von der Traumwelt eingeblendet.
- **Romanauszüge („Aeternus Somnus“):** Eigene Seite `site/roman.html` mit `roman.css` und `roman.js`
  (frei umstylbar, unabhängig von `styles.css`). Die 14 Sätze stehen dort als `<li class="fragment">`;
  ohne JavaScript sind alle sichtbar. Das Feld `fragment` eines Werks in `artworks.json` bzw. `works`
  (`site/app.js`) enthält denselben Satz im Wortlaut für die Großansicht; `scripts/check-site-files.sh`
  prüft, dass er auf `roman.html` vorkommt. Nur kurze Auszüge verwenden, nie das ganze Buch,
  und das Buch selbst nicht ins Repo legen.
- **Neues oder ersetztes Bild:** volle Auflösung nach `assets/artworks/`, Vorschau nach
  `assets/thumbs/`, jeweils als WebP. Ein ersetztes Bild bekommt einen **neuen Dateinamen**, weil
  Bilder eine Woche im Browser gecacht werden.
- **Titelbild:** wird im Hero-HTML, in `styles.css` (Hintergrund) und im Preload in `index.html`
  referenziert.
- **Noch offen vor dem Livegang:** „Werk 01“ usw. sind Platzhalter, keine offiziellen Titel. Die
  Kuratierungssätze sind Vorschläge, keine Künstlerzitate. Es fehlen noch die echte Biografie, die
  Kontaktadresse und das Impressum (österreichisches Recht).
- **Domain:** `canonical`, `og:url` und `og:image` in `index.html` zeigen auf
  `https://simonernstnirnberger.at/`. Bei einer anderen endgültigen Domain anpassen.
- **Einzelne Werke verlinken:** In der Großansicht „Link kopieren“; `?werk=13` öffnet Werk 13.
- **Bewegung:** „Bewegung reduzieren“ im System oder Datensparmodus schaltet die Scroll-Sequenz ab;
  alle Werke bleiben sichtbar und bedienbar.

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
node scripts/preview.mjs            # ohne Docker: http://localhost:8080 (gleiche Header/CSP wie nginx)
scripts/check-site-files.sh         # alle verlinkten Dateien vorhanden?
docker build -t simonnirnberger .   # Produktions-Image
docker run --rm -p 8080:8080 --read-only --tmpfs /tmp simonnirnberger
# http://localhost:8080, http://localhost:8080/healthz, http://localhost:8080/version.txt
```

## Deployment (GitHub Actions → Coolify)

Coolify baut nicht selbst. `.github/workflows/ci.yml` macht bei jedem Push und PR:

1. **Seite prüfen**: JavaScript- und JSON-Syntax, jede verlinkte Datei vorhanden, keine Anfragen an
   fremde Hosts (die CSP erlaubt nur die eigene Domain).
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
