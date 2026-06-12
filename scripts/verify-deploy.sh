#!/usr/bin/env bash
# Post-deploy check: client-routed deep links must rewrite to the SPA shell,
# and (when the API base is given) the shipped bundle must point at a live
# checkout API — catching a stale or unset VITE_CHECKOUT_ENDPOINT that would
# silently degrade /activate to its preview state.
# Usage: ./scripts/verify-deploy.sh <site-base-url> [checkout-api-base-url]
set -euo pipefail

BASE="${1:?usage: verify-deploy.sh <base-url> [checkout-api-base-url]}"
BASE="${BASE%/}"
case "$BASE" in
  https://*|http://localhost*) ;;
  *) echo "FAIL: base URL must be https:// (or http://localhost)"; exit 1 ;;
esac

code=$(curl -s -o /dev/null -w "%{http_code}" -- "$BASE/apply")
if [ "$code" != "200" ]; then
  echo "FAIL: $BASE/apply returned HTTP $code (expected 200 — check the SPA rewrite rule, infra/amplify-rewrites.json)"
  exit 1
fi

# The root div carries data-prerendered since the landing route ships
# prerendered — match the opening of the div, not the old empty shell.
if ! curl -s -- "$BASE/apply" | grep -q '<div id="root"'; then
  echo "FAIL: $BASE/apply did not return the SPA shell"
  exit 1
fi

echo "OK: $BASE/apply rewrites to the SPA shell (HTTP 200)"

bundle=$(curl -s -- "$BASE/" | grep -o '/assets/index-[^"]*\.js' | head -1)
if [ -z "$bundle" ]; then
  echo "FAIL: no JS bundle reference found in the SPA shell"
  exit 1
fi

if [ -n "${2:-}" ]; then
  API="${2%/}"
  host=$(printf '%s' "$API" | sed 's|https://||; s|http://||; s|/.*||')
  if ! curl -s -- "$BASE$bundle" | grep -q "$host"; then
    echo "FAIL: deployed bundle does not contain $host — VITE_CHECKOUT_ENDPOINT is stale or unset (Amplify console env var)"
    exit 1
  fi
  api_code=$(curl -s -o /dev/null -w "%{http_code}" -- "$API/session?session_id=x")
  if [ "$api_code" != "400" ]; then
    echo "FAIL: $API/session?session_id=x returned HTTP $api_code (expected 400 — API down or misrouted)"
    exit 1
  fi
  echo "OK: bundle references $host and the API answers (400 on a garbage session id)"
fi
