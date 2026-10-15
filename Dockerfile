# syntax=docker/dockerfile:1

# Statische Webseite (site/), ausgeliefert von nginx ohne Root-Rechte. Kein Build-Schritt:
# die Seite besteht nur aus HTML, CSS, JavaScript und Bildern.
# Basis-Image: offizielles "unprivileged"-Image von nginx
#   - läuft als User "nginx" (UID 101), nicht als root
#   - lauscht auf Port 8080 (kein privilegierter Port < 1024 nötig)
#   - schreibt PID- und Temp-Dateien nach /tmp (read-only Root-FS möglich)
FROM nginxinc/nginx-unprivileged:1.28-alpine

# Das Basis-Image setzt USER 101; für die Dateirechte kurz root.
USER root

# Eigene Server-Konfiguration (ersetzt den Default-Server).
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Webinhalte gehören root und sind für nginx nur lesbar.
RUN rm -rf /usr/share/nginx/html/*
COPY site/ /usr/share/nginx/html/
# Commit dieses Builds: Die Pipeline prüft nach dem Deploy, dass genau er läuft.
ARG APP_VERSION=dev
RUN printf '%s\n' "$APP_VERSION" > /usr/share/nginx/html/version.txt \
 && chown -R root:root /etc/nginx/conf.d /usr/share/nginx/html \
 && chmod 0444 /etc/nginx/conf.d/default.conf \
 && find /usr/share/nginx/html -type d -exec chmod 0555 {} + \
 && find /usr/share/nginx/html -type f -exec chmod 0444 {} +

# Ab hier wieder ohne Root-Rechte.
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
