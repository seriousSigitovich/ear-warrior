#!/bin/sh
# Pushes the secrets from server/.env to the linked Vercel project (production), as Sensitive values.
# Run it from server/ after `vercel integration add neon` (which sets DATABASE_URL):
#   sh scripts/vercel-env.sh            # real run
#   DRY_RUN=1 sh scripts/vercel-env.sh  # only list what would be set; sends nothing
# Values are read from .env and passed on stdin — never printed. Re-running overwrites; redeploy afterwards.
set -eu
cd "$(dirname "$0")/.."
# A private npm cache: a corrupted ~/.npm/_npx entry (ENOTEMPTY) otherwise breaks `npx vercel@latest`.
export npm_config_cache="${TMPDIR:-/tmp}/ear-warrior-npm-cache"
# VERCEL_BIN=/path/to/vercel skips npx entirely (each npx call re-resolves the CLI and can take minutes).
VERCEL="${VERCEL_BIN:-npx --yes vercel@latest}"
[ -f .env ] || { echo ".env not found in $(pwd)"; exit 1; }

get() { grep "^$1=" .env | head -1 | cut -d= -f2-; }

push() { # push NAME VALUE [--no-sensitive]
  name=$1; value=$2; flag=${3:---sensitive}
  if [ "${DRY_RUN:-}" = "1" ]; then echo "would set $name"; return; fi
  printf '%s' "$value" | $VERCEL env add "$name" production --force "$flag" >/dev/null
  echo "set $name"
}

for key in ADMIN_PASSWORD YT_CLIENT_ID YT_CLIENT_SECRET YT_REFRESH_TOKEN IG_ACCESS_TOKEN; do
  value=$(get "$key")
  if [ -n "$value" ]; then push "$key" "$value"; else echo "skip $key (empty in .env)"; fi
done

# Secret that lets Vercel Cron (and only it) call /api/cron/social.
push CRON_SECRET "$(openssl rand -hex 24)"
# Serverless + Neon's pooled connection string.
push DB_POOL_MAX 1 --no-sensitive
push DB_PREPARE false --no-sensitive
echo "done — now: npx vercel deploy --prod"
