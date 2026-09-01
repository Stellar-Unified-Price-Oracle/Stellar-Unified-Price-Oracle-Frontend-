import { http, HttpResponse } from 'msw'
import type { PathParams } from 'msw'
import { isOracleNetwork, UnknownAssetError, UnknownNetworkError } from '../lib/contractRegistry'
import { mockAllPrices, mockPriceData, mockHistory, mockOnChainPrice } from './data'

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
]
