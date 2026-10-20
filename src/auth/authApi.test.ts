import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkSession } from './authApi'

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('checkSession (#844)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the user for a valid session', async () => {
    const user = { id: 'u1', name: 'Ada', email: null, avatarUrl: null, provider: 'github' }
    stubFetch(async () => new Response(JSON.stringify({ user }), { status: 200 }))

    await expect(checkSession()).resolves.toEqual({ state: 'authenticated', user })
  })

  it('reports an expired session when the server answers 401', async () => {
    stubFetch(async () => new Response(null, { status: 401 }))

    await expect(checkSession()).resolves.toEqual({ state: 'expired' })
  })

  it('reports unavailable, not expired, on a server error', async () => {
    stubFetch(async () => new Response(null, { status: 503 }))

    await expect(checkSession()).resolves.toEqual({ state: 'unavailable' })
  })

  it('reports unavailable, not expired, on a network failure', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(checkSession()).resolves.toEqual({ state: 'unavailable' })
  })
})
