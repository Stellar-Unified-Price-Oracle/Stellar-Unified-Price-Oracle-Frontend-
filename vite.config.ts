/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'resource-hints',
      transformIndexHtml: {
        order: 'post',
        handler(html: string) {
          const apiUrl = process.env.VITE_API_URL || 'http://localhost:3000'
          const wsUrl = process.env.VITE_WS_URL || 'ws://localhost:3000'
          const origins = new Set<string>()

          try {
            origins.add(new URL(apiUrl).origin)
          } catch (err) {
            // ignore invalid URL
            void err
          }

          try {
            origins.add(
              new URL(wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')).origin,
            )
          } catch (err) {
            // ignore invalid URL
            void err
          }

          const hints = Array.from(origins)
            .flatMap((origin) => [
              `<link rel="preconnect" href="${origin}" />`,
              `<link rel="dns-prefetch" href="${origin}" />`,
            ])
            .join('\n    ')

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
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
