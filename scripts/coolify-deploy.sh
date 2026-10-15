#!/usr/bin/env bash
# Deploys one image tag (a commit that passed the pipeline) to Coolify and proves it is running.
#
#   scripts/coolify-deploy.sh <commit-sha>
#
# 1. sets IMAGE_TAG of the app in Coolify (docker-compose.yml runs that image) and pins the
#    app's commit, so Coolify reads the compose file of the same commit
# 2. starts the deployment and follows it; on failure prints the end of Coolify's deployment log
# 3. waits until APP_URL/version.txt shows exactly this commit, then checks the page and /healthz
#
# Environment: COOLIFY_URL, COOLIFY_TOKEN, COOLIFY_APP_UUID, APP_URL
#              DEPLOY_TIMEOUT (900 s), SMOKE_TIMEOUT (180 s), POLL_INTERVAL (10 s), SMOKE_INTERVAL (5 s)
# Writes a summary to $GITHUB_STEP_SUMMARY when set. Exit code 0 only if everything holds.
set -uo pipefail

TAG="${1:?usage: coolify-deploy.sh <commit-sha>}"
: "${COOLIFY_URL:?}" "${COOLIFY_TOKEN:?}" "${COOLIFY_APP_UUID:?}" "${APP_URL:?}"
BASE="${COOLIFY_URL%/}/api/v1"
APP="${APP_URL%/}"
DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-900}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-180}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
# The token goes to curl from a file, not on the command line (where `ps` would show it).
( umask 077; printf 'Authorization: Bearer %s\n' "$COOLIFY_TOKEN" > "$WORK/auth" )

error() { echo "::error::$*"; summary "❌ $*"; }
summary() { [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "$*" >> "$GITHUB_STEP_SUMMARY"; return 0; }

# coolify METHOD PATH [JSON] -> prints the HTTP status, body in $WORK/body
coolify() {
  local args=(-sS -o "$WORK/body" -w '%{http_code}' --max-time 30 -X "$1"
    -H "@$WORK/auth" -H 'Accept: application/json')
  [ $# -ge 3 ] && args+=(-H 'Content-Type: application/json' --data "$3")
  curl "${args[@]}" "${BASE}$2" || echo 000
}
ok() { [ "${1:0:1}" = 2 ]; }

echo "== Deploying ${TAG}"
summary "### Deployment \`${TAG:0:12}\`"

# 1. Which image, and which compose file.
env_json="$(jq -cn --arg v "$TAG" '{key: "IMAGE_TAG", value: $v}')"
code=$(coolify PATCH "/applications/${COOLIFY_APP_UUID}/envs" "$env_json")
if [ "$code" = 404 ]; then code=$(coolify POST "/applications/${COOLIFY_APP_UUID}/envs" "$env_json"); fi
if ! ok "$code"; then
  error "Could not set IMAGE_TAG in Coolify (HTTP $code): $(head -c 300 "$WORK/body"). The API token needs the \"write\" permission."
  exit 1
fi
echo "IMAGE_TAG=${TAG}"
code=$(coolify PATCH "/applications/${COOLIFY_APP_UUID}" "$(jq -cn --arg v "$TAG" '{git_commit_sha: $v}')")
ok "$code" || echo "::warning::Could not pin the commit in Coolify (HTTP $code) – the image is still exact; only the compose file may come from the branch head."

# 2. Deploy and follow it.
for method in POST GET; do
  code=$(coolify "$method" "/deploy?uuid=${COOLIFY_APP_UUID}&force=false")
  [ "$code" = 405 ] || break
done
if ! ok "$code"; then
  error "Coolify refused the deployment (HTTP $code): $(head -c 300 "$WORK/body")"
  exit 1
fi
deployment="$(jq -r '.deployments[0].deployment_uuid // empty' "$WORK/body")"
[ -n "$deployment" ] || { error "Coolify answered without a deployment id: $(head -c 300 "$WORK/body")"; exit 1; }
echo "Coolify deployment ${deployment}"

# Coolify's log, including the entries it marks as hidden (the actual errors often are);
# raw if it is not the expected JSON. Secrets of the app are masked by Coolify itself.
print_log() {
  local lines
  lines="$(jq -r '(.logs // "[]") | (fromjson? // []) | .[-120:][] | .output // empty' "$WORK/body" 2>/dev/null)"
  [ -n "$lines" ] || lines="$(jq -r '.logs // empty' "$WORK/body" 2>/dev/null | tail -n 120)"
  [ -n "$lines" ] || lines="$(head -c 4000 "$WORK/body")"
  local stop; stop="$(openssl rand -hex 16)"
  echo "::group::Coolify deployment log (end)"
  echo "::stop-commands::${stop}" # the log is printed as text, never read as workflow commands
  printf '%s\n' "$lines"
  echo "::${stop}::"
  echo "::endgroup::"
  # The last lines again as an annotation, visible on the run page without opening the log.
  echo "::error title=Coolify deployment log::$(printf '%s' "$lines" | grep -v '^\s*$' | tail -n 8 | tr '\n' ' ' | tr -d ':%' | head -c 900)"
}

# What the outside sees for APP_URL: DNS and who signs the certificate.
diagnose_domain() {
  local host="${APP#*://}"; host="${host%%/*}"; host="${host%%:*}"
  echo "::group::Domain ${host}"
  echo "DNS (public):"; getent ahosts "$host" | awk '{print "  " $1}' | sort -u || echo "  does not resolve"
  echo | openssl s_client -connect "${host}:443" -servername "$host" 2>/dev/null \
    | openssl x509 -noout -subject -issuer -enddate 2>/dev/null | sed 's/^/  /' || echo "  no TLS answer"
  echo "::endgroup::"
}

start=$SECONDS
last=""
while :; do
  if [ $((SECONDS - start)) -ge "$DEPLOY_TIMEOUT" ]; then
    print_log
    error "Deployment ${deployment} did not finish within ${DEPLOY_TIMEOUT}s (last status: ${last:-unknown})"
    exit 1
  fi
  code=$(coolify GET "/deployments/${deployment}")
  if [ "$code" = 401 ] || [ "$code" = 403 ]; then
    error "Coolify refuses to show the deployment status (HTTP $code). The API token needs \"read\" as well as \"deploy\"."
    exit 1
  fi
  status="$(jq -r '.status // "unknown"' "$WORK/body" 2>/dev/null || echo "unreachable (HTTP $code)")"
  if [ "$status" != "$last" ]; then echo "$(date +%T) ${status}"; last="$status"; fi
  case "$status" in
    finished) break ;;
    failed|error|cancelled*)
      print_log
      diagnose_domain
      error "Coolify deployment ${status} – the previous version keeps running unless Coolify already replaced it"
      exit 1 ;;
  esac
  sleep "$POLL_INTERVAL"
done
echo "Deployment finished after $((SECONDS - start))s"

# 3. Is it really this build, and does it work?
start=$SECONDS
running=""
while [ $((SECONDS - start)) -lt "$SMOKE_TIMEOUT" ]; do
  # Only hex digits from the server's answer reach the log.
  running="$(curl -sS --max-time 10 -H 'Cache-Control: no-cache' "${APP}/version.txt" 2>/dev/null | tr -cd '0-9a-f' | head -c 40 || true)"
  [ "$running" = "$TAG" ] && break
  sleep "${SMOKE_INTERVAL:-5}"
done
if [ "$running" != "$TAG" ]; then
  diagnose_domain
  error "${APP} runs version '${running:-none}' instead of ${TAG} after ${SMOKE_TIMEOUT}s"
  exit 1
fi
echo "Version check: ${TAG} is running"

check() { # check NAME EXPECTED_STATUS URL [grep pattern]
  local code
  code=$(curl -sS -o "$WORK/page" -w '%{http_code}' --max-time 15 "$3" || echo 000)
  if [ "$code" != "$2" ] || { [ -n "${4:-}" ] && ! grep -q "$4" "$WORK/page"; }; then
    error "Smoke test '$1': HTTP $code (expected $2) for $3"
    return 1
  fi
  echo "Smoke test '$1': ok"
  [ "$1" = "landing page" ] && cp "$WORK/page" "$WORK/landing"
  return 0
}
failed=0
check "landing page" 200 "${APP}/" '<title>Simon Ernst Nirnberger</title>' || failed=1
check "health" 200 "${APP}/healthz" 'ok' || failed=1
check "not found page" 404 "${APP}/gibt-es-nicht" || failed=1
# The page's script and stylesheet (hashed file names, taken from the page itself).
for asset in $(grep -o '/assets/[^"]*\.\(js\|css\)' "$WORK/landing" 2>/dev/null | sort -u); do
  check "asset ${asset}" 200 "${APP}${asset}" || failed=1
done
[ "$failed" = 0 ] || exit 1

summary "✅ Running \`${TAG}\` on ${APP} (Coolify deployment \`${deployment}\`)"
echo "== ${TAG} is live"
