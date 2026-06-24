/// <reference types="vitest" />
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

type ProxyConfig = Record<string, ProxyOptions>

function parseProxyTarget(env: Record<string, string>, envVar: string): ProxyOptions | null {
  const value = env[envVar]
  if (!value) return null
  try {
    return JSON.parse(value) as ProxyOptions
  } catch {
    return { target: value, changeOrigin: true }
  }
}

function buildProxyConfig(env: Record<string, string>): ProxyConfig {
  const proxyConfig: ProxyConfig = {}

  const apiTarget = parseProxyTarget(env, 'VITE_PROXY_API')
  if (apiTarget) proxyConfig['/api'] = apiTarget

  const wsTarget = parseProxyTarget(env, 'VITE_PROXY_WS')
  if (wsTarget) proxyConfig['/ws'] = wsTarget

  const prefix = 'VITE_PROXY_'
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(prefix) && key !== 'VITE_PROXY_API' && key !== 'VITE_PROXY_WS') {
      const path = '/' + key.slice(prefix.length).toLowerCase().replace(/_/g, '/')
      try {
        proxyConfig[path] = JSON.parse(value) as ProxyOptions
      } catch {
        proxyConfig[path] = { target: value, changeOrigin: true }
      }
    }
  }

  if (Object.keys(proxyConfig).length === 0) {
    proxyConfig['/api'] = { target: env.VITE_API_URL || 'http://localhost:3000', changeOrigin: true }
    proxyConfig['/ws'] = { target: env.VITE_WS_URL || 'ws://localhost:3000', ws: true }
  }

  return proxyConfig
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyConfig = buildProxyConfig(env)

  const apiUrl = env.VITE_API_URL || 'http://localhost:3000'
  const wsUrl = env.VITE_WS_URL || 'ws://localhost:3000'
  const origins = new Set<string>()

  try {
    origins.add(new URL(apiUrl).origin)
  } catch {
  }

  try {
    origins.add(
      new URL(wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')).origin,
    )
  } catch {
  }

  for (const target of Object.values(proxyConfig)) {
    if (typeof target.target === 'string') {
      try {
        origins.add(new URL(target.target).origin)
      } catch {
      }
    }
  }

  const hints = Array.from(origins)
    .flatMap((origin) => [
      `<link rel="preconnect" href="${origin}" />`,
      `<link rel="dns-prefetch" href="${origin}" />`,
    ])
    .join('\n    ')

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'resource-hints',
        transformIndexHtml: {
          order: 'post',
          handler(html: string) {
            return hints ? html.replace('<!-- __RESOURCE_HINTS__ -->', hints) : html
          },
        },
      },
      {
        name: 'preload-critical-assets',
        transformIndexHtml: {
          order: 'post',
          handler(html: string) {
            const jsMatch = html.match(/<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/)
            const cssMatch = html.match(/<link\s+rel="stylesheet"[^>]*href="((?!https?:\/\/)[^"]+)"[^>]*>/)

            const preloads: string[] = []

            if (cssMatch) {
              preloads.push(`<link rel="preload" as="style" href="${cssMatch[1]}" crossorigin />`)
            }

            if (jsMatch) {
              preloads.push(`<link rel="modulepreload" href="${jsMatch[1]}" crossorigin />`)
            }

            if (preloads.length === 0) return html

            return html.replace('</title>', `</title>\n    ${preloads.join('\n    ')}`)
          },
        },
      },
      ...(process.env.ANALYZE === 'true'
        ? [
            visualizer({
              filename: 'reports/bundle-stats.html',
              open: false,
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],
    base: '/Stellar-Unified-Price-Oracle-Frontend-/',
    server: {
      port: 5173,
      proxy: proxyConfig,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }
})