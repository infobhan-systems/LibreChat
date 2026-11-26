#!/bin/sh
# Render Infobhan edge nginx config from DOMAIN_CLIENT mode, then start nginx.
set -eu

MODE="${NGINX_EDGE_MODE:-local}"
OBS_PRIVATE_HOST="${OBS_PRIVATE_HOST:-host.docker.internal}"
export OBS_PRIVATE_HOST

# URL -> hostname (strip scheme, path, userinfo, port).
url_host() {
  printf '%s' "$1" | sed -e 's|^[a-zA-Z][a-zA-Z0-9+.-]*://||' -e 's|^[^@]*@||' -e 's|/.*||' -e 's|:.*||'
}

case "$MODE" in
  tls)
    TEMPLATE="/etc/nginx/templates/infobhan.tls.conf.template"
    if [ ! -f /etc/nginx/ssl/fullchain.pem ] || [ ! -f /etc/nginx/ssl/privkey.pem ]; then
      echo "edge-tls requires ./nginx/certs/fullchain.pem and privkey.pem (Let's Encrypt or self-signed)." >&2
      exit 1
    fi
    if [ -z "${DOMAIN_CLIENT:-}" ] || [ -z "${ADMIN_PANEL_URL:-}" ]; then
      echo "edge-tls requires DOMAIN_CLIENT and ADMIN_PANEL_URL (full URLs in .env)." >&2
      exit 1
    fi
    DOMAIN_CLIENT_HOST="$(url_host "$DOMAIN_CLIENT")"
    ADMIN_PANEL_HOST="$(url_host "$ADMIN_PANEL_URL")"
    if [ -z "$DOMAIN_CLIENT_HOST" ] || [ -z "$ADMIN_PANEL_HOST" ]; then
      echo "edge-tls could not parse host from DOMAIN_CLIENT='$DOMAIN_CLIENT' or ADMIN_PANEL_URL='$ADMIN_PANEL_URL'." >&2
      exit 1
    fi
    if [ "$DOMAIN_CLIENT_HOST" = "$ADMIN_PANEL_HOST" ]; then
      echo "edge-tls requires DOMAIN_CLIENT and ADMIN_PANEL_URL to use different hostnames (got '$DOMAIN_CLIENT_HOST' for both). Path-based /admin on the chat host is not supported." >&2
      exit 1
    fi
    export DOMAIN_CLIENT_HOST ADMIN_PANEL_HOST
    ;;
  local)
    TEMPLATE="/etc/nginx/templates/infobhan.local.conf.template"
    ;;
  *)
    echo "NGINX_EDGE_MODE must be tls or local (got: $MODE)" >&2
    exit 1
    ;;
esac

# Explicit envsubst list so nginx $host / $scheme / $request_uri are not eaten.
SUBST_VARS='${OBS_PRIVATE_HOST} ${DOMAIN_CLIENT_HOST} ${ADMIN_PANEL_HOST}'
if command -v envsubst >/dev/null 2>&1; then
  envsubst "$SUBST_VARS" < "$TEMPLATE" > /etc/nginx/conf.d/default.conf
else
  # Fallback when gettext is absent from the image.
  sed \
    -e "s|\${OBS_PRIVATE_HOST}|${OBS_PRIVATE_HOST}|g" \
    -e "s|\${DOMAIN_CLIENT_HOST}|${DOMAIN_CLIENT_HOST:-}|g" \
    -e "s|\${ADMIN_PANEL_HOST}|${ADMIN_PANEL_HOST:-}|g" \
    "$TEMPLATE" > /etc/nginx/conf.d/default.conf
fi
nginx -t
exec nginx -g 'daemon off;'
