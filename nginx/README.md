# Infobhan nginx edge

App-machine reverse proxy. Traces and Prometheus scrapes stay on the private network; do not publish `/metrics`.

## Mode (from `DOMAIN_CLIENT`)

| `DOMAIN_CLIENT` | Profile | Ports | Browser |
|---|---|---|---|
| `https://…` and host is not localhost / 127.0.0.1 | `edge-tls` | 80 → 443 | `https://infobhan.ai`, `https://admin.infobhan.ai`, `https://watch.infobhan.ai` |
| anything else (e.g. `http://localhost:3000`) | `edge-local` | 3000 → 80 | `http://localhost:3000`, `http://admin.localhost:3000`, `http://watch.localhost:3000` |

Start with `scripts/compose-app.ps1` or `scripts/compose-app.sh` so the profile is chosen automatically.

Set `OBS_PRIVATE_HOST` to the observability machine private IP (Langfuse `:3001`, Grafana `:3002`). LibreChat `LANGFUSE_BASE_URL` must be `http://<that-ip>:3001`, not the public watch URL.

## TLS certificates (`edge-tls`)

Place Let’s Encrypt files at:

- `nginx/certs/fullchain.pem`
- `nginx/certs/privkey.pem`

Example webroot issuance (DNS already points at this host):

```bash
certbot certonly --webroot -w ./nginx/certbot/www \
  -d infobhan.ai -d admin.infobhan.ai -d watch.infobhan.ai
# copy/symlink live certs into nginx/certs/
```

Port 80 serves `/.well-known/acme-challenge/` and redirects everything else to HTTPS.
