# Infobhan nginx edge

App-machine reverse proxy (defined in `docker-compose.yml`). Traces and Prometheus scrapes stay on the private network; do not publish `/metrics`.

Full local and production runbooks (TLS, IP, single vs separate hosts, credentials): [INFOBHAN-DEPLOYMENT.md](../INFOBHAN-DEPLOYMENT.md).

## Mode (from `DOMAIN_CLIENT`)

| `DOMAIN_CLIENT` | Profile | Ports | Browser |
|---|---|---|---|
| `https://…` and host is not localhost / 127.0.0.1 | `edge-tls` | 80 → 443 | Host of `DOMAIN_CLIENT` (chat) and host of `ADMIN_PANEL_URL` (admin). Those hosts must differ. |
| anything else (e.g. `http://localhost:3000`) | `edge-local` | 3000 → 80 | `http://localhost:3000`, `http://admin.localhost:3000`, `http://watch.localhost:3000` |

Start with `scripts/compose-app.ps1` or `scripts/compose-app.sh` so the profile is chosen automatically.

- `edge-local` uses `docker-compose.yml` only (no Ollama / GPU exporters).
- `edge-tls` also merges `docker-compose.infobhan.yml`.
- Laptop with Ollama: `scripts/compose-app.ps1 -WithGpu up -d` or `scripts/compose-app.sh --with-gpu up -d`.

### TLS hostnames (env-driven)

`edge-tls` reads `DOMAIN_CLIENT` and `ADMIN_PANEL_URL` from the app `.env`, parses their hostnames, and substitutes them into [`infobhan.tls.conf.template`](infobhan.tls.conf.template). There is **no** public watch vhost on TLS: Langfuse and Grafana stay on private `:3001` / `:3002` (set `OBS_PRIVATE_HOST` / `LANGFUSE_BASE_URL` for app→obs traffic). Local edge still proxies `watch.localhost` when observability is on the same machine.

Example:

```env
DOMAIN_CLIENT=https://chat.infobhan.net
DOMAIN_SERVER=https://chat.infobhan.net
ADMIN_PANEL_URL=https://admin.infobhan.net
ADMIN_PANEL_SESSION_COOKIE_SECURE=true
```

## TLS certificates (`edge-tls`)

Place Let’s Encrypt files at:

- `nginx/certs/fullchain.pem`
- `nginx/certs/privkey.pem`

Cert names must match the hosts parsed from `DOMAIN_CLIENT` and `ADMIN_PANEL_URL`. Example (DNS already points at this host):

```bash
certbot certonly --webroot -w ./nginx/certbot/www \
  -d chat.infobhan.net -d admin.infobhan.net
# copy/symlink live certs into nginx/certs/
```

Port 80 serves `/.well-known/acme-challenge/` and redirects everything else to HTTPS.
