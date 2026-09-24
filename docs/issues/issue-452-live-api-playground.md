# Issue #452 — Add a Live API Playground ("Try It") to the `/api-docs` Page

## Summary

The `/api-docs` page documents every Oracle API endpoint with syntax-highlighted
code snippets (curl, JavaScript, Python) and copy buttons. It does not let
developers execute those requests from the browser. A live "Try it" console
alongside each endpoint would let developers validate request shapes and inspect
real responses before writing any integration code.

---

## Current State in `src/pages/ApiDocs.tsx`

### What already exists

The `TryItOut` component is already implemented and mounted under every
`EndpointCard` that has a `tryPath` defined. It provides:

**Editable path field** — `<input>` pre-populated with `endpoint.tryPath` (e.g.
`/api/prices/XLM-USD`)

**JSON body editor** — `<textarea>` shown for `POST` endpoints, pre-populated
with `endpoint.body`

**"Send" button** — calls `fetch()` with the correct method, headers, and body;
measures latency with `performance.now()`

**Response rendering** — pretty-prints JSON with 2-space indent in a `<pre>`
block; falls back to raw text for non-JSON responses

**Rate-limit header capture** — reads `X-RateLimit-*` and `Retry-After` from
the response and displays them inline:

```ts
res.headers.forEach((value, key) => {
  if (key.toLowerCase().startsWith('x-ratelimit-') || key.toLowerCase() === 'retry-after') responseHeaders[key] = value
})
```

**Error rendering** — if the response is not OK and the body contains a
`message` field, it is displayed in a red `<pre>` block

**Latency display** — `${latency}ms` shown below the response

**Snippet generation** — `buildSnippet()` generates curl, JavaScript, and
Python snippets for all three methods (GET, POST, WS) from the live
`config.apiUrl` base URL

**Copy button** — `navigator.clipboard.writeText(snippet)` with a 1.5s
"Copied!" confirmation

### Endpoints covered by `TryItOut` (`tryPath` defined)

| Endpoint                    | Method | `tryPath`                                   |
| --------------------------- | ------ | ------------------------------------------- |
| `/api/prices`               | GET    | `/api/prices`                               |
| `/api/prices/:pair`         | GET    | `/api/prices/XLM-USD`                       |
| `/api/prices/:pair/history` | GET    | `/api/prices/XLM-USD/history?limit=10`      |
| `/api/prices/history/batch` | POST   | `/api/prices/history/batch`                 |
| `/health`                   | GET    | `/health`                                   |
| `/ws`                       | WS     | — (no `tryPath`, `TryItOut` returns `null`) |

### Gaps against acceptance criteria

| Gap                                         | Detail                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| WS endpoint has no interactive console      | `TryItOut` returns `null` for `method === 'WS'`; there is no WebSocket "connect / subscribe" panel                |
| Path params are not parsed                  | `/api/prices/:pair` is pre-filled as `/api/prices/XLM-USD` but `:pair` is a raw string — no labelled param inputs |
| Response syntax highlighting                | The `<pre>` shows plain JSON text; no colour coding                                                               |
| Schema validation errors                    | Error state shows `parsed.message` but not the schema path or field name                                          |
| Snippet does not update when path is edited | `buildSnippet()` uses `endpoint.tryPath`, not the live `path` state                                               |
| No request history                          | Each new request overwrites the previous result; there is no way to compare responses                             |
| No auth / API-key header field              | Advanced users cannot set custom headers (e.g. `Authorization`) from the UI                                       |

---

## Acceptance Criteria

### AC1 — Every documented endpoint can be executed from the page

All five REST endpoints already have `tryPath` set. The WS endpoint needs a
dedicated WebSocket panel (see §WebSocket console below).

### AC2 — Request snippets are copy-paste correct

`buildSnippet()` must use the **live** `path` state (after the user edits it)
rather than the static `endpoint.tryPath`:

```ts
// Current (uses static tryPath):
const snippet = buildSnippet(lang, endpoint, baseUrl)

// Fixed (pass live path into snippet builder):
function buildSnippet(lang: SnippetLang, endpoint: Endpoint, baseUrl: string, livePath: string): string {
  const fullPath = livePath   // replaces: endpoint.tryPath ?? endpoint.path
  ...
}
```

This ensures that if a user edits the path field to `/api/prices/BTC-USD`, the
generated snippet reflects `BTC-USD`, not `XLM-USD`.

### AC3 — Errors render with the API validation message and schema path

When the response is not OK, the error panel must show:

- HTTP status and status text
- The `message` field from the response body (already shown)
- The `field` or `path` field if present (schema validation errors from Zod)

```ts
// Proposed error extraction in TryItOut:
if (!res.ok && typeof parsed === 'object' && parsed !== null) {
  const p = parsed as Record<string, unknown>
  const parts = [p.message, p.field ?? p.path].filter(Boolean)
  setError(parts.join(' — '))
}
```

### AC4 — Show rate-limit headers and latency per request

Already implemented. Enhancement: format the reset timestamp as a human-readable
countdown rather than a raw Unix timestamp:

```ts
// Replace: "x-ratelimit-reset: 1720000000"
// With:    "resets in 42s"
const resetMs = Number(headers['x-ratelimit-reset']) * 1000 - Date.now()
const resetLabel = resetMs > 0 ? `resets in ${Math.ceil(resetMs / 1000)}s` : 'reset'
```

---

## WebSocket Console (new — AC1 gap)

The WS endpoint needs an interactive console. Proposed implementation:

```tsx
function WsTryItOut() {
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [pairs, setPairs] = useState('XLM-USD')
  const connected = ws !== null && ws.readyState === WebSocket.OPEN

  const connect = () => {
    const socket = new WebSocket(`${config.wsUrl}`)
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'subscribe', pairs: pairs.split(',').map((p) => p.trim()) }))
    }
    socket.onmessage = (event: MessageEvent<string>) => {
      setMessages((prev) => [event.data, ...prev].slice(0, 20))
    }
    socket.onclose = () => setWs(null)
    setWs(socket)
  }

  const disconnect = () => {
    ws?.close()
    setWs(null)
  }

  return (
    <div className="mt-3 space-y-2">
      <label className="text-xs text-gray-500">
        Pairs (comma-separated)
        <input
          value={pairs}
          onChange={(e) => setPairs(e.target.value)}
          className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={connected ? disconnect : connect}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            connected
              ? 'bg-red-900/40 border-red-800 text-red-400 hover:bg-red-900/70'
              : 'bg-cyan-900/40 border-cyan-800 text-cyan-400 hover:bg-cyan-900/70'
          }`}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
        {connected && <span className="text-xs text-emerald-400 self-center">● Live</span>}
      </div>
      {messages.length > 0 && (
        <pre className="p-3 rounded-lg bg-gray-950 text-gray-300 text-xs overflow-auto max-h-64">
          {messages.join('\n')}
        </pre>
      )}
    </div>
  )
}
```

Mount `<WsTryItOut />` in the WS `EndpointCard` in place of the current
`null` return.

---

## Path Parameter Inputs (enhancement — AC2)

Endpoints with named path parameters (`:pair`) should parse the parameter names
from `endpoint.path` and render labelled inputs:

```ts
// Parse :pair from "/api/prices/:pair"
const params = endpoint.path.match(/:(\w+)/g)?.map((p) => p.slice(1)) ?? []
// ['pair']
```

Each param gets a labelled text input. On change, replace the token in the live
path:

```ts
const fillPath = (template: string, values: Record<string, string>) =>
  template.replace(/:(\w+)/g, (_, name) => encodeURIComponent(values[name] ?? name))
```

---

## Syntax Highlighting

The response `<pre>` block uses plain text today. A minimal, dependency-free
approach is to tokenise JSON keys vs values with CSS classes:

```ts
function highlightJson(json: string): string {
  return json
    .replace(/"([^"]+)":/g, '<span class="text-cyan-400">"$1"</span>:')
    .replace(/: "([^"]+)"/g, ': <span class="text-green-400">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="text-amber-400">$1</span>')
    .replace(/: (true|false|null)/g, ': <span class="text-purple-400">$1</span>')
}
```

Render with `dangerouslySetInnerHTML` (the input is already parsed through
`JSON.parse` / `JSON.stringify`, so it is safe and fully controlled).

---

## Affected Files

| File                    | Change type                                                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/ApiDocs.tsx` | Fix snippet to use live path state; add `WsTryItOut` component; improve error rendering; add reset countdown; optionally add path param inputs and JSON highlighting |
| `docs/API.md`           | Add a note pointing to the `/api-docs` playground                                                                                                                    |

---

## Related

- Issue #453 — Webhook management UI (same developer section of the app)
- Issue #455 — SDK quickstart (the `/api-docs` page links to the quickstart doc)
- `src/pages/ApiDocs.tsx` — `TryItOut`, `EndpointCard`, `buildSnippet` — full implementation
- `docs/API.md` — endpoint reference (source of truth for `tryPath` values)
- `src/config.ts` — `config.apiUrl`, `config.wsUrl` — base URLs used in snippet generation
