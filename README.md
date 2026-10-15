# simonnirnberger

Statische Webseite, ausgeliefert per nginx in einem Docker-Container mit minimalen Rechten.
Gedacht für das Deployment über [Coolify](https://coolify.io).

## Struktur

```
.
├── index.html          # Einstiegsseite (Vite)
├── src/
│   ├── main.js         # Three.js-Szene, Scroll (GSAP + Lenis), Jolts, CONFIG mit allen Stellschrauben
│   ├── style.css
│   └── shaders/        # GLSL: Noise, Kugel (Vertex/Fragment), Post-Processing
├── public/             # Wird unverändert kopiert (404-Seite, Favicon)
├── vite.config.js      # Build nach dist/; `vite preview` sendet dieselben Header wie nginx
├── Dockerfile          # Stage 1: Vite-Build als User "node"; Stage 2: nginx-unprivileged (UID 101)
├── docker-compose.yml  # Laufzeit-Härtung (read-only, keine Capabilities, Limits)
├── .dockerignore       # Allowlist für den Build-Kontext
└── nginx/
    └── default.conf    # Port 8080, Security-Header (CSP), Caching, /healthz
```

## Entwicklung

```sh
npm install
npm run dev       # http://localhost:5173 (lauscht auf 0.0.0.0)
npm run build     # erzeugt dist/
npm run preview   # dist/ unter http://localhost:4173, mit den CSP-Headern aus nginx/default.conf
```

Zur Laufzeit gibt es keine externen Requests: three, gsap, lenis und die Schriften (Rock Salt
für den Namen, Figtree für die Labels, beide via `@fontsource`) werden mitgebaut.

### Anpassen

Alle Werte stehen oben in `src/main.js` im Objekt `CONFIG`:

| Wert | Wirkung |
| --- | --- |
| `paper`, `ink` | Papier- und Tintenfarbe (Papier auch in `--paper` in `style.css`) |
| `startSize`, `startX` | Größe und Position des Blobs oben |
| `endCover` | Wie weit der Blob am Ende über den Bildschirmrand hinausreicht |
| `energy` | Grundunruhe oben → unten |
| `jolt.amount`, `jolt.decay` | Stärke und Abklingzeit der Zuckungen |
| `jolt.minDelay`, `jolt.maxDelay` | Abstand zwischen den Zuckungen (Sekunden) |
| `grain` | Papierkorn |
| `eyes.reach`, `eyes.blinkMin`, `eyes.blinkMax` | Wie weit die Augen schauen und wie oft sie blinzeln |

Die Textfarben in `style.css` sind für `mix-blend-mode: difference` berechnet (siehe Kommentar dort):
Wer `paper` oder `ink` ändert, muss `--name` und `--muted` mit anpassen.

Noise-Frequenz und -Geschwindigkeit stehen kommentiert in `src/shaders/sphere.vert`.

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
docker compose build
docker compose run --rm -p 8080:8080 web
# http://localhost:8080 und http://localhost:8080/healthz
```

## Deployment mit Coolify

1. In Coolify: **New Resource → Public/Private Repository** und dieses Repo wählen.
2. **Build Pack: Docker Compose** wählen (nutzt `docker-compose.yml` mit allen Härtungen).
3. Beim Service `web` die Domain eintragen (z. B. `https://simonnirnberger.de:8080` bzw.
   Port 8080 angeben). Coolify erzeugt TLS-Zertifikate und routet über seinen Proxy.
4. Deployen. Der Healthcheck `/healthz` zeigt Coolify, wann der Container bereit ist.

Alternativ geht auch **Build Pack: Dockerfile** mit *Ports Exposes* `8080`. Dann gelten
nur die Härtungen aus dem `Dockerfile`; `read_only`, `cap_drop` usw. müssten in Coolify
unter *Custom Docker Options* ergänzt werden, z. B.
`--read-only --tmpfs /tmp:size=16m,noexec,nosuid,nodev --cap-drop=ALL --security-opt=no-new-privileges`.
