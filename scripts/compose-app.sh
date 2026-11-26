#!/usr/bin/env bash
# Run docker compose for the Infobhan app stack with the nginx edge profile
# derived from DOMAIN_CLIENT in .env.
# edge-local: docker-compose.yml only (laptop-safe, no Ollama).
# edge-tls: also merges docker-compose.infobhan.yml (GPU host).
# Pass --with-gpu to merge the Infobhan overlay even for edge-local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

WITH_GPU=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --with-gpu)
      WITH_GPU=1
      ;;
    *)
      ARGS+=("$arg")
      ;;
  esac
done

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

compose_args=(-f docker-compose.yml)
merge_gpu=0
if [[ "$WITH_GPU" -eq 1 || "$profile" == "edge-tls" ]]; then
  compose_args+=(-f docker-compose.infobhan.yml)
  merge_gpu=1
fi

gpu_note=""
if [[ "$merge_gpu" -eq 1 ]]; then
  gpu_note=" (+infobhan GPU overlay)"
fi
echo "DOMAIN_CLIENT=${DOMAIN_CLIENT:-<unset>} → --profile ${profile}${gpu_note}"
exec docker compose "${compose_args[@]}" --profile "$profile" "${ARGS[@]}"
