import { http, HttpResponse } from 'msw'
import { mockAllPrices, mockPriceData, mockHistory } from './data'

export const handlers = [
  http.get('/api/prices', () => HttpResponse.json(mockAllPrices())),

  http.get('/api/prices/:pair/history', ({ params }) => {
    const pair = decodeURIComponent(params['pair'] as string)
    return HttpResponse.json(mockHistory(pair))
  }),

  http.get('/api/prices/:pair', ({ params }) => {
    const pair = decodeURIComponent(params['pair'] as string)
    return HttpResponse.json(mockPriceData(pair))
  }),

  http.post('/api/prices/history/batch', async ({ request }) => {
    const body = (await request.json()) as { pairs: string[] }
    return HttpResponse.json(body.pairs.map((p) => mockHistory(p)))
  }),

  http.get('/health', () =>
    HttpResponse.json({ status: 'ok', uptime: Math.floor(Math.random() * 86400) }),
  ),
]
