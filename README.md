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
