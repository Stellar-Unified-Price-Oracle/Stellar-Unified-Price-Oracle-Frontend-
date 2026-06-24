import { http, HttpResponse } from 'msw'
import { PAIRS, makePriceData, makeHistory } from './data'

export const handlers = [
  http.get('/api/prices', ({ request }) => {
    const url = new URL(request.url)
    const pairsParam = url.searchParams.get('pairs')
    const pairs = pairsParam ? pairsParam.split(',').filter(p => PAIRS.includes(p)) : PAIRS
    return HttpResponse.json(pairs.map(makePriceData))
  }),

  http.get('/api/prices/:pair', ({ params }) => {
    const pair = decodeURIComponent(params.pair as string)
    if (!PAIRS.includes(pair)) {
      return HttpResponse.json({ error: 'pair not found' }, { status: 404 })
    }
    return HttpResponse.json(makePriceData(pair))
  }),

  http.get('/api/prices/:pair/history', ({ params, request }) => {
    const pair = decodeURIComponent(params.pair as string)
    if (pair === 'ERROR') {
      return HttpResponse.json({ error: 'internal server error' }, { status: 500 })
    }
    if (!PAIRS.includes(pair)) {
      return HttpResponse.json({ error: 'pair not found' }, { status: 404 })
    }
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500)
    return HttpResponse.json(makeHistory(pair, limit))
  }),

  http.post('/api/prices/history/batch', async ({ request }) => {
    const body = await request.json() as { pairs?: string[] }
    const pairs = (body?.pairs ?? []).filter((p: string) => PAIRS.includes(p))
    return HttpResponse.json(pairs.map(p => makeHistory(p)))
  }),

  http.get('/health', () =>
    HttpResponse.json({ status: 'ok', timestamp: Date.now() })
  ),
]
