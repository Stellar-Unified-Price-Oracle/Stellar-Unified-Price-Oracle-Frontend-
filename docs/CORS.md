# CORS Configuration for Backend Deployments

The frontend makes cross-origin requests to the Aggregator API. This document describes the CORS policy the backend must implement so that browser clients can connect successfully.

## Required CORS Policy

| Setting | Value |
|---|---|
| Allowed origins | The frontend's deployed origin (e.g. `https://your-app.vercel.app`) |
| Allowed methods | `GET`, `POST`, `OPTIONS` |
| Allowed headers | `Content-Type`, `Authorization` |
| Exposed headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |
| Credentials | `true` if you use session cookies; `false` otherwise |
| Preflight max-age | `86400` (24 h cache for OPTIONS responses) |

> **Development:** During local development Vite proxies `/api` and `/ws` to `localhost:3000`, so the browser never sees a cross-origin request. CORS configuration only matters for production builds served from a separate origin.

## Preflight Handling

Browsers send an `OPTIONS` preflight before any request that:
- Uses a method other than `GET` / `HEAD` / `POST`
- Includes a non-simple header (e.g. `Content-Type: application/json`)

The backend **must** respond to `OPTIONS` requests with the appropriate `Access-Control-*` headers and a `204` (or `200`) status.

## Example Configurations

### Express

```js
import cors from 'cors'

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: false,
    maxAge: 86400,
  }),
)
```

### Fastify

```js
import fastifyCors from '@fastify/cors'

await fastify.register(fastifyCors, {
  origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  credentials: false,
  maxAge: 86400,
})
```

### Cloudflare Workers

```js
const ALLOWED_ORIGIN = 'https://your-app.vercel.app'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
  'Access-Control-Max-Age': '86400',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const response = await handleRequest(request)
    const headers = new Headers(response.headers)
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      headers.set(key, value)
    }
    return new Response(response.body, { ...response, headers })
  },
}
```

## Multiple Allowed Origins

If you need to allow more than one origin (e.g. preview deployments), maintain a list and reflect the origin dynamically only when it is in the list:

```js
const ALLOWED_ORIGINS = new Set([
  'https://your-app.vercel.app',
  'https://preview.your-app.vercel.app',
  'http://localhost:5173',
])

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  next()
})
```

> Never use `Access-Control-Allow-Origin: *` in production — it prevents `credentials: true` and exposes the API to any site.

## Testing CORS

### curl

Simulate a preflight from the frontend origin:

```sh
curl -i -X OPTIONS https://api.example.com/api/prices \
  -H "Origin: https://your-app.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type"
```

The response must include:

```
Access-Control-Allow-Origin: https://your-app.vercel.app
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

Simulate a real GET request:

```sh
curl -i https://api.example.com/api/prices \
  -H "Origin: https://your-app.vercel.app" \
  -H "Content-Type: application/json"
```

The response body should be returned alongside the `Access-Control-Allow-Origin` header.

### Browser DevTools

Open the **Network** tab, filter by **Fetch/XHR**, and look for requests to your API host. A failing CORS preflight appears as a red `OPTIONS` request with no `Access-Control-Allow-Origin` in the response headers. The browser will also log a descriptive CORS error in the **Console** tab.
