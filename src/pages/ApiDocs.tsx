import { useState } from 'react'
import { config } from '../config'

type Method = 'GET' | 'POST' | 'WS'
type SnippetLang = 'curl' | 'javascript' | 'python'

interface Endpoint {
  method: Method
  path: string
  description: string
  note?: string
  tryPath?: string
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/prices',
    description: 'Returns the latest aggregated price for every tracked asset pair.',
    tryPath: '/api/prices',
  },
  {
    method: 'GET',
    path: '/api/prices/:pair',
    description: 'Returns the latest aggregated price for a single asset pair.',
    tryPath: '/api/prices/XLM-USD',
  },
  {
    method: 'GET',
    path: '/api/prices/:pair/history',
    description: 'Returns paginated price history for a single asset pair.',
    tryPath: '/api/prices/XLM-USD/history?limit=10',
  },
  {
    method: 'POST',
    path: '/api/prices/history/batch',
    description: 'Fetches price history for multiple asset pairs in a single request.',
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

function buildSnippet(lang: SnippetLang, endpoint: Endpoint, baseUrl: string): string {
  const fullPath = endpoint.tryPath ?? endpoint.path
  const url = `${baseUrl}${fullPath}`

  if (lang === 'curl') {
    if (endpoint.method === 'POST') {
      return `curl -X POST ${baseUrl}/api/prices/history/batch \\
  -H "Content-Type: application/json" \\
  -d '{"pairs":["XLM-USD","BTC-USD"]}'`
    }
    if (endpoint.method === 'WS') {
      return `# Connect with wscat (npm install -g wscat)
wscat -c ${baseUrl.replace(/^https?/, 'ws')}/ws`
    }
    return `curl ${url}`
  }

  if (lang === 'javascript') {
    if (endpoint.method === 'POST') {
      return `const res = await fetch('${baseUrl}/api/prices/history/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
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
    return `const res = await fetch('${url}')
const data = await res.json()
console.log(data)`
  }

  if (lang === 'python') {
    if (endpoint.method === 'POST') {
      return `import requests

resp = requests.post(
    '${baseUrl}/api/prices/history/batch',
    json={'pairs': ['XLM-USD', 'BTC-USD']},
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

resp = requests.get('${url}')
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
}

function TryItOut({ endpoint }: { endpoint: Endpoint }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!endpoint.tryPath || endpoint.method === 'WS') return null

  const handleTry = async () => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch(`${config.apiUrl.replace(/\/api$/, '')}${endpoint.tryPath}`)
      const text = await res.text()
      try {
        setResult(JSON.stringify(JSON.parse(text), null, 2))
      } catch {
        setResult(text)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
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
        {loading ? 'Sending…' : 'Try it out'}
      </button>
      {error && (
        <pre className="mt-2 p-3 rounded-lg bg-red-900/20 border border-red-800 text-red-400 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
          {error}
        </pre>
      )}
      {result && (
        <pre className="mt-2 p-3 rounded-lg bg-gray-900 border border-gray-700 text-gray-300 text-xs overflow-auto max-h-64">
          {result}
        </pre>
      )}
    </div>
  )
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [lang, setLang] = useState<SnippetLang>('curl')
  const [copied, setCopied] = useState(false)

  const baseUrl = config.apiUrl.replace(/\/api$/, '')
  const snippet = buildSnippet(lang, endpoint, baseUrl)

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${METHOD_COLORS[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-gray-200">{endpoint.path}</code>
        <p className="w-full text-sm text-gray-400 mt-0.5">{endpoint.description}</p>
        {endpoint.note && <p className="w-full text-xs text-gray-500 italic">{endpoint.note}</p>}
      </div>

      <div className="border-t border-gray-800 px-4 pt-3 pb-4">
        <div className="flex gap-1 mb-2" role="tablist" aria-label="Code snippet language">
          {(['curl', 'javascript', 'python'] as SnippetLang[]).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                lang === l
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {LANG_LABELS[l]}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCopy}
            className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Copy snippet"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="p-3 rounded-lg bg-gray-950 text-gray-300 text-xs overflow-x-auto leading-relaxed">
          {snippet}
        </pre>
        <TryItOut endpoint={endpoint} />
      </div>
    </div>
  )
}

export function ApiDocs() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Documentation</h1>
        <p className="text-sm text-gray-400 mt-1">
          REST and WebSocket endpoints exposed by the Stellar Unified Price Oracle Aggregator.
        </p>
        {config.openApiSpecUrl && (
          <a
            href={config.openApiSpecUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm rounded-lg border border-cyan-800 bg-cyan-900/20 text-cyan-400 hover:bg-cyan-900/40 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open OpenAPI Spec
          </a>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-gray-500">
        <span>Base URL: <code className="font-mono text-gray-300">{config.apiUrl.replace(/\/api$/, '')}</code></span>
        <span>WS: <code className="font-mono text-gray-300">{config.wsUrl}</code></span>
      </div>

      <div className="space-y-4">
        {ENDPOINTS.map((ep) => (
          <EndpointCard key={`${ep.method}-${ep.path}`} endpoint={ep} />
        ))}
      </div>
    </div>
  )
}
