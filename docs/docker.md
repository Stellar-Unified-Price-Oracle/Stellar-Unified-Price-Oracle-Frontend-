# Docker Setup

This project ships a multi-stage `Dockerfile` and a `docker-compose.yml` so you
can develop and deploy without installing Node locally.

---

## Quick Start (development)

```bash
# 1. Copy environment config
cp .env.example .env

# 2. Start the Vite dev server with hot reload
docker compose up

# → http://localhost:5173
```

Source files in `src/`, `public/`, and `index.html` are bind-mounted into the
container so edits on your host are reflected instantly via HMR — no rebuild needed.

---

## Build stages

The `Dockerfile` has four stages:

| Stage | Target flag | Description |
|-------|------------|-------------|
| `deps` | (internal) | Runs `npm ci` — cached separately from code |
| `development` | `--target development` | Vite dev server with HMR |
| `builder` | (internal) | Type-checks and produces `dist/` |
| `production` | `--target production` | Nginx serving the built assets |

### Development image

```bash
docker build --target development -t oracle-frontend:dev .
docker run -p 5173:5173 \
  -v "$(pwd)/src:/app/src" \
  -v "$(pwd)/public:/app/public" \
  -v "$(pwd)/index.html:/app/index.html" \
  oracle-frontend:dev
```

### Production image

```bash
docker build \
  --target production \
  --build-arg VITE_API_URL=https://api.example.com \
  --build-arg VITE_WS_URL=wss://api.example.com \
  -t oracle-frontend:prod .

docker run -p 80:80 oracle-frontend:prod
```

The production image is based on `nginx:1.27-alpine` and serves the static bundle
with aggressive caching for hashed assets and no-cache for `index.html`.

---

## Docker Compose

### Start

```bash
docker compose up            # start (foreground)
docker compose up -d         # start (detached)
docker compose up --build    # rebuild image before starting
```

### Stop

```bash
docker compose down          # stop and remove containers
docker compose down -v       # also remove the node_modules volume
```

### Logs

```bash
docker compose logs -f frontend
```

### Rebuild after dependency changes

When you change `package.json` or `package-lock.json`, the `node_modules` layer is
stale. Run:

```bash
docker compose down -v       # remove node_modules volume
docker compose up --build    # reinstall and restart
```

---

## Local overrides

Create `docker-compose.override.yml` (gitignored) for machine-specific settings:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
```

Docker Compose merges it automatically. Use it to:
- Change the host port (`FRONTEND_PORT`)
- Point the frontend at a real backend (`VITE_API_URL`, `VITE_WS_URL`)
- Enable MSW mocks (`VITE_USE_MOCK=true`)

Example override:

```yaml
version: "3.9"
services:
  frontend:
    ports:
      - "4000:5173"
    environment:
      VITE_USE_MOCK: "true"
```

---

## Environment variables

All `VITE_*` variables are forwarded from `.env` into the container via the
`env_file` directive in `docker-compose.yml`.

| Variable | Default | Description |
|---------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | REST API base URL |
| `VITE_WS_URL` | `ws://localhost:3000` | WebSocket endpoint |
| `VITE_USE_MOCK` | `false` | Enable MSW mock service worker |
| `FRONTEND_PORT` | `5173` | Host port mapped to the container |

For a production build, `VITE_API_URL` and `VITE_WS_URL` are baked into the bundle
at build time via `--build-arg`.

---

## Health checks

Both the development and production containers expose a health check endpoint:

| Container | URL | Expected |
|-----------|-----|---------|
| development (Vite) | `http://localhost:5173/` | HTTP 200 |
| production (Nginx) | `http://localhost/health` | `ok` |

Docker polls the health check every 10 s (dev) / 15 s (prod). A container that
fails 3 consecutive checks is marked `unhealthy`.

---

## Resource limits

The `docker-compose.yml` sets soft limits to keep the dev container from consuming
all available memory on a shared machine:

| Resource | Limit | Reservation |
|---------|-------|------------|
| Memory | 1 GB | 256 MB |
| CPU | 2 cores | — |

Adjust these in `docker-compose.override.yml` if needed.

---

## Nginx configuration (production)

The production Nginx config lives in `docker/nginx.conf`. Key behaviours:

- **SPA routing** — all non-file requests fall back to `index.html`.
- **Hashed assets** — JS/CSS/fonts are cached for 1 year with `immutable`.
- **`index.html`** — always served with `no-store` so new deployments take effect
  immediately.
- **Health endpoint** — `GET /health` returns `200 ok` without disk I/O.
- **Security headers** — `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`.
- **Gzip** — enabled for text assets ≥ 1 KB.
