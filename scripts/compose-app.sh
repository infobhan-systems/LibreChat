#!/usr/bin/env bash
# Run docker compose for the Infobhan app stack with the nginx edge profile
# derived from DOMAIN_CLIENT in .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOMAIN_CLIENT=""
if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  # Prefer DOMAIN_CLIENT lines; ignore comments.
  DOMAIN_CLIENT="$(grep -E '^[[:space:]]*DOMAIN_CLIENT=' .env | tail -n1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)"
  set +a
fi

profile="edge-local"
if [[ "$DOMAIN_CLIENT" =~ ^https:// ]]; then
  host="${DOMAIN_CLIENT#https://}"
  host="${host%%/*}"
  host="${host%%:*}"
  host_lc="$(printf '%s' "$host" | tr '[:upper:]' '[:lower:]')"
  if [[ "$host_lc" != "localhost" && "$host_lc" != "127.0.0.1" ]]; then
    profile="edge-tls"
  fi
fi

echo "DOMAIN_CLIENT=${DOMAIN_CLIENT:-<unset>} → --profile ${profile}"
exec docker compose -f docker-compose.yml -f docker-compose.infobhan.yml --profile "$profile" "$@"
