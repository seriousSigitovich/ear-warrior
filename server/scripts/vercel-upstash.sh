#!/bin/sh
# Lets /admin/social read the waitlist sources the live landing writes to Upstash (signup_sources).
# Copies the Upstash REST URL and the READ-ONLY token from the ear-warrior-landing project into this
# one (ear-warrior-api, production) as Sensitive values. The read-only token is stored under the name
# the code reads (KV_REST_API_TOKEN): HGETALL is all the dashboard does, so it never gets write access.
# Run it from server/, then redeploy:
#   sh scripts/vercel-upstash.sh && vercel deploy --prod
# Values go through a 0600 temp file and stdin — never printed; the file is removed on exit.
set -eu
cd "$(dirname "$0")/.."
VERCEL="${VERCEL_BIN:-vercel}"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
chmod 600 "$tmp"

(cd ../landing && $VERCEL env pull "$tmp" --environment=production --yes >/dev/null)

get() { grep "^$1=" "$tmp" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }

url=$(get KV_REST_API_URL)
ro=$(get KV_REST_API_READ_ONLY_TOKEN)
[ -n "$url" ] && [ -n "$ro" ] || { echo "KV_REST_API_URL / KV_REST_API_READ_ONLY_TOKEN not found in the landing project"; exit 1; }

printf '%s' "$url" | $VERCEL env add KV_REST_API_URL production --force --sensitive >/dev/null
printf '%s' "$ro" | $VERCEL env add KV_REST_API_TOKEN production --force --sensitive >/dev/null
echo "set KV_REST_API_URL, KV_REST_API_TOKEN (read-only) — now: vercel deploy --prod"
