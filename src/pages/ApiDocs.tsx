import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { config } from '../config'
import { getAcceptVersionHeader } from '../api/version'
import { useApiVersion } from '../hooks/useApiVersion'
import { METRIC_HELP_TOPICS, type MetricHelpTopic } from '../data/metricHelp'
import { isOracleNetwork, type OracleNetwork } from '../lib/contractRegistry'
import { getSelectedNetwork, onNetworkChange } from '../lib/networkRegistry'
import { SdkIntegrationChecklist } from '../components/SdkIntegrationChecklist'
import { SdkMigrationGuide } from '../components/SdkMigrationGuide'
import { OracleClient } from '../sdk/client'
import { createClientTraceId, reportNetworkError } from '../utils/errorReporting'

/** How long the "Copied!" confirmation stays visible after copying a snippet. */
const COPY_FEEDBACK_RESET_MS = 1500

type Method = 'GET' | 'POST' | 'WS'
type SnippetLang = 'curl' | 'javascript' | 'python' | 'sdk'
type SdkMethod = 'getPrices' | 'getPrice' | 'getHistory'

/**
 * The network and API version copied snippets should target (#807). Built from
 * the developer-selected network (falling back to the build's oracle network)
 * and the server version negotiated by `/api/version`.
 */
interface SnippetContext {
  network: OracleNetwork
  /** Server API version, or null while detection is still pending. */
  apiVersion: string | null
  /** Accept header value matching the negotiated API version. */
  acceptHeader: string
}

interface Endpoint {
  method: Method
  path: string
  description: string
  note?: string
  tryPath?: string
  body?: string
  sdkMethod?: SdkMethod
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/prices',
    description: 'Returns the latest aggregated price for every tracked asset pair.',
    tryPath: '/api/prices',
    sdkMethod: 'getPrices',
  },
  {
    method: 'GET',
    path: '/api/prices/:pair',
    description: 'Returns the latest aggregated price for a single asset pair.',
    tryPath: '/api/prices/XLM-USD',
    sdkMethod: 'getPrice',
  },
  {
    method: 'GET',
    path: '/api/prices/:pair/history',
    description: 'Returns paginated price history for a single asset pair.',
    tryPath: '/api/prices/XLM-USD/history?limit=10',
    sdkMethod: 'getHistory',
  },
  {
    method: 'POST',
    path: '/api/prices/history/batch',
    description: 'Fetches price history for multiple asset pairs in a single request.',
    tryPath: '/api/prices/history/batch',
    body: '{"pairs":["XLM-USD","BTC-USD"]}',
  },
  {
    method: 'GET',
    path: '/health',
    description: 'Returns API server health status and uptime in seconds.',
    tryPath: '/health',
  },
  {
    method: 'WS',
    path: '/ws',
    description: 'WebSocket endpoint — emits price_update events as prices change.',
  },
]

/** Resolves the developer-selected network, falling back to the build's configured network. */
function resolveNetwork(): OracleNetwork {
  const selected = getSelectedNetwork()
  if (selected) return selected
  return isOracleNetwork(config.oracleNetwork) ? config.oracleNetwork : 'testnet'
}

function buildSnippetContext(network: OracleNetwork, serverVersion: string | null): SnippetContext {
  return {
    network,
    apiVersion: serverVersion,
    acceptHeader: getAcceptVersionHeader(serverVersion),
  }
}

/** Leading comment that records which network and API version the snippet targets. */
function snippetPreamble(lang: SnippetLang, ctx: SnippetContext): string {
  const marker = lang === 'curl' || lang === 'python' ? '#' : '//'
  const version = ctx.apiVersion ?? 'detecting…'
  return `${marker} Network: ${ctx.network} · API version: ${version}\n`
}

function buildSnippet(
  lang: SnippetLang,
  endpoint: Endpoint,
  baseUrl: string,
  livePath: string,
  ctx: SnippetContext,
): string {
  return snippetPreamble(lang, ctx) + buildSnippetBody(lang, endpoint, baseUrl, livePath, ctx)
}

function buildSnippetBody(
  lang: SnippetLang,
  endpoint: Endpoint,
  baseUrl: string,
  livePath: string,
  ctx: SnippetContext,
): string {
  const fullPath = livePath
  const url = `${baseUrl}${fullPath}`

  if (lang === 'sdk') {
    if (endpoint.sdkMethod === 'getPrices') {
      return `import { OracleClient } from '@stellar-unified-price-oracle/sdk'

const client = new OracleClient({ baseUrl: '${baseUrl}' })
const prices = await client.getPrices()
console.log(prices)`
    }
    const pair = endpoint.tryPath?.match(/^\/api\/prices\/([^/?]+)/)?.[1] ?? 'XLM-USD'
    if (endpoint.sdkMethod === 'getHistory') {
      return `import { OracleClient } from '@stellar-unified-price-oracle/sdk'

const client = new OracleClient({ baseUrl: '${baseUrl}' })
const history = await client.getHistory('${pair}', 10)
console.log(history)`
    }
    if (endpoint.sdkMethod === 'getPrice') {
      return `import { OracleClient } from '@stellar-unified-price-oracle/sdk'

const client = new OracleClient({ baseUrl: '${baseUrl}' })
const price = await client.getPrice('${pair}')
console.log(price)`
    }
    return ''
  }

  if (lang === 'curl') {
    if (endpoint.method === 'POST') {
      return `curl -X POST ${baseUrl}/api/prices/history/batch \\
  -H "Content-Type: application/json" \\
  -H "Accept: ${ctx.acceptHeader}" \\
  -d '{"pairs":["XLM-USD","BTC-USD"]}'`
    }
    if (endpoint.method === 'WS') {
      return `# Connect with wscat (npm install -g wscat)
wscat -c ${baseUrl.replace(/^https?/, 'ws')}/ws`
    }
    return `curl ${url} \\
  -H "Accept: ${ctx.acceptHeader}"`
  }

  if (lang === 'javascript') {
    if (endpoint.method === 'POST') {
      return `const res = await fetch('${baseUrl}/api/prices/history/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: '${ctx.acceptHeader}' },
  body: JSON.stringify({ pairs: ['XLM-USD', 'BTC-USD'] }),
})
const data = await res.json()
console.log(data)`
    }
    if (endpoint.method === 'WS') {
      return `const ws = new WebSocket('${baseUrl.replace(/^https?/, 'ws')}/ws')
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  console.log(msg)
}`
    }
    return `const res = await fetch('${url}', {
  headers: { Accept: '${ctx.acceptHeader}' },
})
const data = await res.json()
console.log(data)`
  }

  if (lang === 'python') {
    if (endpoint.method === 'POST') {
      return `import requests

resp = requests.post(
    '${baseUrl}/api/prices/history/batch',
    json={'pairs': ['XLM-USD', 'BTC-USD']},
    headers={'Accept': '${ctx.acceptHeader}'},
)
print(resp.json())`
    }
    if (endpoint.method === 'WS') {
      return `import websocket, json

def on_message(ws, message):
    print(json.loads(message))

ws = websocket.WebSocketApp('${baseUrl.replace(/^https?/, 'ws')}/ws', on_message=on_message)
ws.run_forever()`
    }
    return `import requests

resp = requests.get('${url}', headers={'Accept': '${ctx.acceptHeader}'})
print(resp.json())`
  }

  return ''
}

const METHOD_COLORS: Record<Method, string> = {
  GET: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  POST: 'bg-blue-900/40 text-blue-400 border-blue-800',
  WS: 'bg-purple-900/40 text-purple-400 border-purple-800',
}

const LANG_LABELS: Record<SnippetLang, string> = {
  curl: 'curl',
  javascript: 'JavaScript',
  python: 'Python',
  sdk: 'SDK',
}

/**
 * Response headers that carry cache status/CDN metadata, checked in priority
 * order (#508). Different edge layers (Vercel, Cloudflare, a custom
 * SWR-aware origin) name this header differently, so we surface whichever is
 * present rather than assuming one CDN.
 */
const CACHE_STATUS_HEADERS = ['x-cache-status', 'cf-cache-status', 'x-vercel-cache', 'x-cache']

function readCacheStatus(headers: Headers): string | null {
  for (const name of CACHE_STATUS_HEADERS) {
    const value = headers.get(name)
    if (value) return value
  }
  return null
}

function pairFromPath(path: string): string {
  const match = path.match(/^\/api\/prices\/([^/?]+)/)
  if (!match) throw new Error('Set a valid pair path, for example /api/prices/XLM-USD')
  try {
    return decodeURIComponent(match[1])
  } catch {
    throw new Error('The pair in the request path is not valid URL encoding')
  }
}

function TryItOut({ endpoint, path, setPath }: { endpoint: Endpoint; path: string; setPath: (path: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cacheStatus, setCacheStatus] = useState<string | null>(null)
  const [body, setBody] = useState<string>('{}')
  const [latency, setLatency] = useState<number | null>(null)
  const [headers, setHeaders] = useState<Record<string, string>>({})
  const { t } = useTranslation()

  if (!endpoint.tryPath || endpoint.method === 'WS') return null

  const handleTry = async () => {
    setLoading(true)
    setResult(null)
    setError(null)
    setCacheStatus(null)
    setLatency(null)
    setHeaders({})
    const traceId = createClientTraceId()
    const startedAt = performance.now()
    try {
      const base = config.apiUrl.replace(/\/api$/, '')
      const res = await fetch(`${base}${path}`, {
        method: endpoint.method,
        headers: endpoint.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: endpoint.method === 'POST' ? body : undefined,
      })
      setLatency(Math.round(performance.now() - startedAt))

      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })
      setHeaders(responseHeaders)
      setCacheStatus(readCacheStatus(res.headers))
      const text = await res.text()
      let requestError: string | null = null
      try {
        const parsed: unknown = JSON.parse(text)
        setResult(JSON.stringify(parsed, null, 2))
        if (!res.ok) {
          requestError =
            typeof parsed === 'object' && parsed !== null && 'message' in parsed
              ? String(parsed.message)
              : `${res.status} ${res.statusText}: ${text}`
        }
      } catch {
        if (res.ok) setResult(text)
        else requestError = `${res.status} ${res.statusText}: ${text}`
      }
      if (requestError) {
        setError(`${requestError}\nTrace ID: ${traceId}`)
        reportNetworkError(requestError, {
          method: endpoint.method,
          url: `${base}${path}`,
          status: res.status,
          statusText: res.statusText,
          responseTime: performance.now() - startedAt,
          traceId,
        })
      }
    } catch (err) {
      setLatency(Math.round(performance.now() - startedAt))
      const message = err instanceof Error ? err.message : 'Request failed'
      setError(`${message}\nTrace ID: ${traceId}`)
      reportNetworkError(message, {
        method: endpoint.method,
        url: `${config.apiUrl.replace(/\/api$/, '')}${path}`,
        responseTime: performance.now() - startedAt,
        traceId,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSdkRun = async () => {
    if (!endpoint.sdkMethod) return
    setLoading(true)
    setResult(null)
    setError(null)
    setLatency(null)
    const traceId = createClientTraceId()
    let requestStarted = false
    const startedAt = performance.now()
    try {
      const baseUrl = config.apiUrl.replace(/\/api$/, '')
      const client = new OracleClient({ baseUrl, maxRetries: 0 })
      let value: unknown
      if (endpoint.sdkMethod === 'getPrices') {
        requestStarted = true
        value = await client.getPrices()
      } else if (endpoint.sdkMethod === 'getPrice') {
        const pair = pairFromPath(path)
        requestStarted = true
        value = await client.getPrice(pair)
      } else {
        const parsedPath = new URL(path, window.location.origin)
        const limit = Number(parsedPath.searchParams.get('limit') ?? 10)
        const offset = Number(parsedPath.searchParams.get('offset') ?? 0)
        const pair = pairFromPath(parsedPath.pathname)
        requestStarted = true
        value = await client.getHistory(pair, limit, offset)
      }
      setResult(JSON.stringify(value, null, 2))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SDK request failed'
      setError(requestStarted ? `${message}\nTrace ID: ${traceId}` : message)
      if (requestStarted) {
        reportNetworkError(message, {
          method: 'GET',
          url: `${config.apiUrl.replace(/\/api$/, '')}${path}`,
          responseTime: performance.now() - startedAt,
          traceId,
        })
      }
    } finally {
      setLatency(Math.round(performance.now() - startedAt))
      setLoading(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleTry}
        disabled={loading}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-900/40 border border-cyan-800 text-cyan-400 hover:bg-cyan-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? t('apiDocs.sending') : t('apiDocs.tryItOut')}
      </button>
      {endpoint.sdkMethod && (
        <button
          type="button"
          onClick={handleSdkRun}
          disabled={loading}
          className="ml-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-900/40 border border-purple-800 text-purple-300 hover:bg-purple-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Running…' : 'Run SDK example'}
        </button>
      )}
      {cacheStatus && (
        <p className="mt-2 text-xs font-mono text-gray-400">
          {t('apiDocs.cacheStatus', 'Cache:')} <span className="text-gray-300">{cacheStatus}</span>
        </p>
      )}
      {error && (
        <pre
          role="alert"
          className="mt-2 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-xs overflow-auto max-h-48 whitespace-pre-wrap"
        >
          {error}
        </pre>
      )}
      {result && (
        <pre
          aria-live="polite"
          className="mt-2 p-3 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 text-xs overflow-auto max-h-64"
        >
          {result}
        </pre>
      )}
      <div className="mt-3 grid gap-2">
        <label className="text-xs text-gray-400">
          Path
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200"
          />
        </label>
        {endpoint.method === 'POST' && (
          <label className="text-xs text-gray-400">
            JSON body
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-200 font-mono"
            />
          </label>
        )}
      </div>
      {(latency != null || Object.keys(headers).length > 0) && (
        <p className="mt-2 text-xs text-gray-400">
          {latency != null ? `${latency}ms` : ''}
          {Object.entries(headers)
            .map(([key, value]) => ` · ${key}: ${value}`)
            .join('')}
        </p>
      )}
    </div>
  )
}

function EndpointCard({ endpoint, context }: { endpoint: Endpoint; context: SnippetContext }) {
  const [lang, setLang] = useState<SnippetLang>('curl')
  const [copied, setCopied] = useState(false)
  const [path, setPath] = useState<string>(() => endpoint.tryPath ?? '')
  const { t } = useTranslation()

  const baseUrl = config.apiUrl.replace(/\/api$/, '')
  const snippet = buildSnippet(lang, endpoint, baseUrl, path, context)
  const snippetId = `snippet-${endpoint.method}-${endpoint.path.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_RESET_MS)
    })
  }

  return (
    // Opaque dark card in every theme — the translucent version blended with
    // the light page background and failed colour-contrast for its light text.
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${METHOD_COLORS[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-gray-200">{endpoint.path}</code>
        <p className="w-full text-sm text-gray-400 mt-0.5">{endpoint.description}</p>
        {endpoint.note && <p className="w-full text-xs text-gray-400 italic">{endpoint.note}</p>}
      </div>

      <div className="border-t border-gray-800 px-4 pt-3 pb-4">
        {/* The Copy control sits beside — not inside — the tablist: a tablist
            may only contain role=tab children (aria-required-children). */}
        <div className="flex gap-1 mb-2 items-center">
          <div className="flex gap-1" role="tablist" aria-label={t('export.langSelector')}>
            {(['curl', 'javascript', 'python', ...(endpoint.sdkMethod ? ['sdk' as const] : [])] as SnippetLang[]).map(
              (l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  tabIndex={lang === l ? 0 : -1}
                  aria-selected={lang === l}
                  aria-controls={snippetId}
                  onKeyDown={(event) => {
                    const tabs = Array.from(
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
                    )
                    const currentIndex = tabs.indexOf(event.currentTarget)
                    const nextIndex =
                      event.key === 'ArrowRight'
                        ? (currentIndex + 1) % tabs.length
                        : event.key === 'ArrowLeft'
                          ? (currentIndex - 1 + tabs.length) % tabs.length
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? tabs.length - 1
                              : -1
                    if (nextIndex >= 0) {
                      event.preventDefault()
                      tabs[nextIndex].focus()
                      tabs[nextIndex].click()
                    }
                  }}
                  onClick={() => setLang(l)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    lang === l ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  {LANG_LABELS[l]}
                </button>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="ms-auto text-xs text-gray-400 hover:text-gray-200 transition-colors"
            aria-label={t('apiDocs.copy')}
          >
            {copied ? t('apiDocs.copied') : t('apiDocs.copy')}
          </button>
        </div>
        <pre
          id={snippetId}
          role="tabpanel"
          aria-label={`${LANG_LABELS[lang]} example for ${endpoint.path}`}
          tabIndex={0}
          className="p-3 rounded-lg bg-gray-950 text-gray-300 text-xs overflow-x-auto leading-relaxed"
        >
          {snippet}
        </pre>
        <TryItOut endpoint={endpoint} path={path} setPath={setPath} />
      </div>
    </div>
  )
}

export function ApiDocs() {
  const { t } = useTranslation()
  const apiInfo = useApiVersion()
  const [network, setNetwork] = useState<OracleNetwork>(resolveNetwork)
  useEffect(() => onNetworkChange(setNetwork), [])
  const context = buildSnippetContext(network, apiInfo?.serverVersion || null)
  // Mock mode uses same-origin requests (empty apiUrl), so the checklist falls back to the page origin.
  const checklistBaseUrl = config.apiUrl.replace(/\/api$/, '') || window.location.origin
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('apiDocs.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('apiDocs.subtitle')}</p>
        {config.openApiSpecUrl && (
          <a
            href={config.openApiSpecUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400 dark:hover:bg-cyan-900/40 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            {t('apiDocs.openSpec')}
          </a>
        )}
        <a
          href="https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/blob/main/docs/on-chain.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 ms-2 px-3 py-1.5 text-sm rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400 dark:hover:bg-cyan-900/40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Read the oracle on-chain
        </a>
        <a
          href="https://github.com/Stellar-Unified-Price-Oracle/Stellar-Unified-Price-Oracle-Frontend-/blob/main/docs/sdk-quickstart.md"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-3 ms-2 px-3 py-1.5 text-sm rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400 dark:hover:bg-cyan-900/40 transition-colors"
        >
          SDK quickstarts
        </a>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
        <span>
          {t('apiDocs.baseUrl')}{' '}
          <code className="font-mono text-gray-800 dark:text-gray-300">{config.apiUrl.replace(/\/api$/, '')}</code>
        </span>
        <span>
          {t('apiDocs.ws')} <code className="font-mono text-gray-800 dark:text-gray-300">{config.wsUrl}</code>
        </span>
        <span>
          Network: <code className="font-mono text-gray-800 dark:text-gray-300">{context.network}</code>
        </span>
        <span>
          API version:{' '}
          <code className="font-mono text-gray-800 dark:text-gray-300">{context.apiVersion ?? 'detecting…'}</code>
        </span>
      </div>

      <SdkIntegrationChecklist baseUrl={checklistBaseUrl} />

      <div className="space-y-4">
        {ENDPOINTS.map((ep) => (
          <EndpointCard key={`${ep.method}-${ep.path}`} endpoint={ep} context={context} />
        ))}
      </div>

      <SdkMigrationGuide />

      <section id="metric-help" aria-labelledby="metric-help-heading" className="mt-10 border-t border-gray-800 pt-6">
        <h2 id="metric-help-heading" className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('metricHelp.docsTitle')}
        </h2>
        <div className="mt-3 space-y-4">
          {(
            Object.entries(METRIC_HELP_TOPICS) as [MetricHelpTopic, (typeof METRIC_HELP_TOPICS)[MetricHelpTopic]][]
          ).map(([topic, definition]) => (
            <article key={topic} id={definition.docsAnchor}>
              <h3 className="font-medium text-gray-800 dark:text-gray-200">{t(definition.titleKey)}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t(definition.descriptionKey)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
