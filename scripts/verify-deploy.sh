#!/usr/bin/env bash
# Post-deploy verification for the DEPLOYED site (catches silent config drift a
# local build can't — a stale Amplify env var, a missing rewrite, an unapplied
# header). Checks:
#   1. the dedicated prerender rewrite serves the prerendered /apply page
#   2. the catch-all SPA rewrite serves the shell for an arbitrary deep link
#   3. the sitemap is served statically
#   4. the security headers are present and the CSP carries the expected origins
#   5. (with the API base) the deployed JS references a live checkout API
# Usage: ./scripts/verify-deploy.sh <site-base-url> [checkout-api-base-url]
set -euo pipefail

MAX_TIME=15

fail() { echo "FAIL: $*" >&2; exit 1; }

# Fail the script (with a clear message) on a transport error, rather than dying
# silently under `set -e` with curl's stderr suppressed by -s.
fetch() { curl -fsS --max-time "$MAX_TIME" -- "$1" || fail "could not fetch $1 (network/DNS/timeout or non-2xx)"; }
http_code() { curl -s -o /dev/null -w "%{http_code}" --max-time "$MAX_TIME" -- "$1"; }

# Accumulate a de-duplicated, space-separated set of chunk paths.
chunks=""
add_chunk() { case " $chunks " in *" $1 "*) ;; *) chunks="$chunks $1" ;; esac; }

BASE="${1:?usage: verify-deploy.sh <base-url> [checkout-api-base-url]}"
BASE="${BASE%/}"
# Cleartext is allowed only for a genuine localhost (exact, :port, or /path) —
# NOT for hosts like http://localhost.evil.com that a loose glob would admit.
case "$BASE" in
  https://* | http://localhost | http://localhost:* | http://localhost/*) ;;
  *) fail "base URL must be https:// (or http://localhost)" ;;
esac

# 1) Dedicated prerender rewrite: /apply must serve the PRERENDERED apply page
#    (its data-route marker), not the catch-all homepage.
code=$(http_code "$BASE/apply")
[ "$code" = "200" ] || fail "$BASE/apply returned HTTP $code (expected 200 — check the /apply → /apply.html rewrite, infra/amplify-rewrites.json)"
fetch "$BASE/apply" | grep -q 'data-route="/apply"' \
  || fail "$BASE/apply did not serve the prerendered apply page (no data-route=\"/apply\") — the dedicated /apply rewrite may be missing"
echo "OK: $BASE/apply serves the prerendered apply page (dedicated rewrite)"

# 2) Catch-all SPA fallback: an arbitrary deep link with no dedicated rule must
#    still return the SPA shell (HTTP 200), served as the prerendered homepage.
probe="/__verify_deploy_probe__"
code=$(http_code "$BASE$probe")
[ "$code" = "200" ] || fail "$BASE$probe returned HTTP $code (expected 200 — the SPA catch-all rewrite is missing or misordered)"
fetch "$BASE$probe" | grep -q '<div id="root"' \
  || fail "$BASE$probe did not return the SPA shell — the catch-all rewrite is broken"
echo "OK: the catch-all rewrite serves the SPA shell for deep links"

# 3) Sitemap is served statically (the catch-all regex excludes .xml).
code=$(http_code "$BASE/sitemap.xml")
[ "$code" = "200" ] || fail "$BASE/sitemap.xml returned HTTP $code (expected 200 — the .xml passthrough may be broken)"
fetch "$BASE/sitemap.xml" | grep -q '<urlset' \
  || fail "$BASE/sitemap.xml is not a sitemap (<urlset> missing)"
echo "OK: sitemap.xml is served statically"

# 4) Security headers present, and the CSP carries the origins we expect.
hdrs=$(curl -fsSI --max-time "$MAX_TIME" -- "$BASE/") || fail "could not fetch response headers from $BASE/"
for h in strict-transport-security x-content-type-options content-security-policy; do
  printf '%s' "$hdrs" | grep -qi "^$h:" || fail "response from $BASE/ is missing the $h header"
done
csp=$(printf '%s' "$hdrs" | grep -i '^content-security-policy:')
printf '%s' "$csp" | grep -q 'api.groundstatesociety.com' || fail "CSP connect-src is missing api.groundstatesociety.com"
printf '%s' "$csp" | grep -q 'cdn.sanity.io' || fail "CSP img-src is missing https://cdn.sanity.io (Signal issue images would be blocked)"
echo "OK: security headers present and the CSP carries the expected origins"

# 5) (optional) The deployed JS references the configured checkout API host.
if [ -n "${2:-}" ]; then
  API="${2%/}"
  case "$API" in
    https://* | http://localhost | http://localhost:* | http://localhost/*) ;;
    *) fail "checkout API base must be https:// (or http://localhost)" ;;
  esac
  host=$(printf '%s' "$API" | sed 's|https://||; s|http://||; s|/.*||')

  # VITE_CHECKOUT_ENDPOINT is read only in the lazy-loaded Activate/Welcome
  # chunks, NOT the entry index-*.js. Collect chunk paths referenced by the shell
  # AND the chunk basenames embedded (as dynamic-import literals) inside those
  # chunks, then search them all. grep -F so the host's dots are literal.
  shell=$(fetch "$BASE/")
  for p in $(printf '%s' "$shell" | grep -oE '/assets/[A-Za-z0-9._-]+\.js' | sort -u || true); do add_chunk "$p"; done
  embedded=$(for c in $chunks; do curl -fsS --max-time "$MAX_TIME" -- "$BASE$c" 2>/dev/null || true; done \
               | grep -oE '[A-Za-z0-9._-]+-[A-Za-z0-9_-]+\.js' | sort -u || true)
  for n in $embedded; do add_chunk "/assets/$n"; done
  [ -n "$chunks" ] || fail "no JS chunks found referenced by $BASE/"

  found=
  for c in $chunks; do
    if curl -fsS --max-time "$MAX_TIME" -- "$BASE$c" 2>/dev/null | grep -qF "$host"; then found=1; break; fi
  done
  [ -n "$found" ] || fail "no deployed JS chunk references $host — VITE_CHECKOUT_ENDPOINT is stale or unset (Amplify console env var)"

  api_code=$(http_code "$API/session?session_id=x")
  [ "$api_code" = "400" ] || fail "$API/session?session_id=x returned HTTP $api_code (expected 400 — API down or misrouted)"
  echo "OK: a deployed chunk references $host and the API answers (400 on a garbage session id)"
fi

echo "OK: all deploy checks passed"
