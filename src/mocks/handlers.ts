import { http, HttpResponse } from 'msw'
import { mockPrices, mockHistory } from './data'

export const handlers = [
  http.get('*/api/prices', () => HttpResponse.json(mockPrices())),
  http.get('*/api/prices/:pair/history', ({ params }) => {
    const pair = decodeURIComponent(params.pair as string)
    return HttpResponse.json(mockHistory(pair))
  }),
  http.get('*/api/prices/:pair', ({ params }) => {
    const pair = decodeURIComponent(params.pair as string)
    const price = mockPrices().find((p) => p.assetPair === pair)
    return price ? HttpResponse.json(price) : HttpResponse.json({ error: 'Not found' }, { status: 404 })
  }),
  http.get('*/health', () => HttpResponse.json({ status: 'ok', uptime: 12345 })),
]
