#!/bin/sh
# Render Infobhan edge nginx config from DOMAIN_CLIENT mode, then start nginx.
set -eu

MODE="${NGINX_EDGE_MODE:-local}"
OBS_PRIVATE_HOST="${OBS_PRIVATE_HOST:-host.docker.internal}"
export OBS_PRIVATE_HOST

case "$MODE" in
  tls)
    TEMPLATE="/etc/nginx/templates/infobhan.tls.conf.template"
    if [ ! -f /etc/nginx/ssl/fullchain.pem ] || [ ! -f /etc/nginx/ssl/privkey.pem ]; then
      echo "edge-tls requires ./nginx/certs/fullchain.pem and privkey.pem (Let's Encrypt or self-signed)." >&2
      exit 1
    fi
    ;;
  local)
    TEMPLATE="/etc/nginx/templates/infobhan.local.conf.template"
    ;;
  *)
    echo "NGINX_EDGE_MODE must be tls or local (got: $MODE)" >&2
    exit 1
    ;;
esac

if command -v envsubst >/dev/null 2>&1; then
  envsubst '${OBS_PRIVATE_HOST}' < "$TEMPLATE" > /etc/nginx/conf.d/default.conf
else
  # Fallback when gettext is absent from the image.
  sed "s|\${OBS_PRIVATE_HOST}|${OBS_PRIVATE_HOST}|g" "$TEMPLATE" > /etc/nginx/conf.d/default.conf
fi
nginx -t
exec nginx -g 'daemon off;'
