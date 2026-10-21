#!/bin/sh
# Copies the mailbox credentials (SMTP_USER, SMTP_PASS) that the landing project already uses to the API
# project, then redeploys it, so sign-in codes can be mailed (spec 005). Run it from server/:
#   sh scripts/copy-smtp.sh            # real run
#   DRY_RUN=1 sh scripts/copy-smtp.sh  # only checks both values exist; changes nothing
# Values go through a temp file (deleted on exit) and stdin — they are never printed.
set -eu
cd "$(dirname "$0")/.."
# A private npm cache: a corrupted ~/.npm/_npx entry (ENOTEMPTY) otherwise breaks `npx vercel@latest`.
export npm_config_cache="${TMPDIR:-/tmp}/ear-warrior-npm-cache"
VERCEL="${VERCEL_BIN:-npx --yes vercel@latest}"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
(cd ../landing && $VERCEL env pull "$tmp" --environment production --yes >/dev/null)

get() { grep "^$1=" "$tmp" | head -1 | cut -d= -f2- | sed 's/^"//; s/"$//'; }
user=$(get SMTP_USER)
pass=$(get SMTP_PASS)
# Vercel writes "[SENSITIVE]" instead of the value for Sensitive variables: they can never be read back.
readable() { [ -n "$1" ] && [ "$1" != "[SENSITIVE]" ]; }

readable "$user" || { echo "SMTP_USER is empty, missing or Sensitive in the landing project: enter it with 'vercel env add SMTP_USER production'"; exit 1; }
if ! readable "$pass"; then
  echo "SMTP_PASS in the landing project is Sensitive (cannot be read back), so it cannot be copied."
  [ "${DRY_RUN:-}" = "1" ] && { echo "dry run: would copy only SMTP_USER; you then enter SMTP_PASS yourself"; exit 0; }
  printf '%s' "$user" | $VERCEL env add SMTP_USER production --force >/dev/null
  echo "set SMTP_USER. Now enter the password yourself, then deploy:"
  echo "  vercel env add SMTP_PASS production   (answer y to Sensitive)"
  echo "  vercel deploy --prod"
  exit 0
fi

if [ "${DRY_RUN:-}" = "1" ]; then echo "found SMTP_USER and SMTP_PASS in landing; would copy both to ear-warrior-api and redeploy"; exit 0; fi

printf '%s' "$user" | $VERCEL env add SMTP_USER production --force >/dev/null
echo "set SMTP_USER"
printf '%s' "$pass" | $VERCEL env add SMTP_PASS production --force --sensitive >/dev/null
echo "set SMTP_PASS"
$VERCEL deploy --prod --yes | tail -3
