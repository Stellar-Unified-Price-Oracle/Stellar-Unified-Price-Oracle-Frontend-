import { http, HttpResponse } from 'msw'
import type { PathParams } from 'msw'
import { isOracleNetwork, UnknownAssetError, UnknownNetworkError } from '../lib/contractRegistry'
import { mockAllPrices, mockPriceData, mockHistory, mockOnChainPrice, mockPriceProof } from './data'

export const handlers = [
  http.get<PathParams<'network' | 'asset'>>('/api/onchain/:network/:asset', ({ params }) => {
    const network = params['network'] as string
    const asset = decodeURIComponent(params['asset'] as string)

    if (!isOracleNetwork(network)) {
      return HttpResponse.json({ error: new UnknownNetworkError(network).message }, { status: 404 })
    }
    try {
      return HttpResponse.json(mockOnChainPrice(network, asset))
    } catch (err) {
      if (err instanceof UnknownAssetError) {
        return HttpResponse.json({ error: err.message }, { status: 404 })
      }
      throw err
    }
  }),

  http.get('/api/prices', () => HttpResponse.json(mockAllPrices())),

  http.get<PathParams<'pair'>>('/api/prices/:pair/history', ({ params }) => {
    const pair = decodeURIComponent(params['pair'] as string)
    return HttpResponse.json(mockHistory(pair))
  }),

  http.get<PathParams<'pair'>>('/api/prices/:pair/proof', ({ params, request }) => {
    const pair = decodeURIComponent(params['pair'] as string)
    const timestampParam = new URL(request.url).searchParams.get('timestamp')
    const timestamp = timestampParam ? Number(timestampParam) : undefined
    const proof = mockPriceProof(pair, timestamp)
    if (!proof) {
      return HttpResponse.json({ error: 'No on-chain proof available for this asset pair' }, { status: 404 })
    }
    return HttpResponse.json(proof)
  }),

  http.get<PathParams<'pair'>>('/api/prices/:pair', ({ params }) => {
    const pair = decodeURIComponent(params['pair'] as string)
    return HttpResponse.json(mockPriceData(pair))
  }),

  http.post('/api/prices/history/batch', async ({ request }) => {
    const body = (await request.json()) as { pairs: string[] }
    return HttpResponse.json(body.pairs.map((p) => mockHistory(p)))
  }),

  http.get('/health', () => HttpResponse.json({ status: 'ok', uptime: Math.floor(Math.random() * 86400) })),

  // Version endpoint — without this the client's /api/version probe falls
  // through to the Vite dev/preview proxy (api.example.com) and returns 502.
  // Echo the client's own build version so the compatibility banner stays
  // silent in the mock build (a real backend would report its own version).
  http.get('/api/version', () =>
    HttpResponse.json({
      success: true,
      version: '0.0.0',
      serverVersion: '0.0.0',
      minClientVersion: undefined,
      maxClientVersion: undefined,
      breaking: false,
      deprecated: false,
      supportedFeatures: [],
    }),
  ),
]
