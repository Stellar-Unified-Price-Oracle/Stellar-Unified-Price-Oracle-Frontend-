import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SdkIntegrationChecklist } from './SdkIntegrationChecklist'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const BASE_URL = 'https://api.example.test'

function stubApi(routes: Record<string, { status: number; body?: unknown }>) {
  const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname
    const route = routes[path] ?? { status: 404 }
    return new Response(route.body === undefined ? null : JSON.stringify(route.body), {
      status: route.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', mockFetch)
  return mockFetch
}

const HEALTHY_API = {
  '/health': { status: 200 },
  '/api/prices': {
    status: 200,
    body: [{ assetPair: 'XLM-USD', price: 0.12, timestamp: 1_700_000_000_000 }],
  },
  '/api/prices/XLM-USD': {
    status: 200,
    body: { assetPair: 'XLM-USD', price: 0.12, timestamp: 1_700_000_000_000 },
  },
}

describe('SdkIntegrationChecklist (#808)', () => {
  it('runs every check against the API and reports the pass count', async () => {
    const user = userEvent.setup()
    const mockFetch = stubApi(HEALTHY_API)
    render(<SdkIntegrationChecklist baseUrl={BASE_URL} />)

    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    await user.click(screen.getByRole('button', { name: 'Run all checks' }))

    expect(await screen.findByText('4 of 4 checks passed')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledWith(`${BASE_URL}/health`, expect.any(Object))
    expect(mockFetch).toHaveBeenCalledWith(`${BASE_URL}/api/prices/XLM-USD`, expect.any(Object))
  })

  it('shows a failing step with its reason while the others still pass', async () => {
    const user = userEvent.setup()
    stubApi({ ...HEALTHY_API, '/api/prices': { status: 200, body: [] } })
    render(<SdkIntegrationChecklist baseUrl={BASE_URL} />)

    await user.click(screen.getByRole('button', { name: 'Run all checks' }))

    expect(await screen.findByText('3 of 4 checks passed')).toBeInTheDocument()
    const failedItem = screen.getByText('Parse the aggregated price list').closest('li') as HTMLElement
    expect(within(failedItem).getByText('Failed')).toBeInTheDocument()
    expect(within(failedItem).getByText(/empty/)).toBeInTheDocument()
  })

  it('runs a single check on its own without touching the other endpoints', async () => {
    const user = userEvent.setup()
    const mockFetch = stubApi(HEALTHY_API)
    render(<SdkIntegrationChecklist baseUrl={BASE_URL} />)

    await user.click(screen.getByRole('button', { name: 'Run check: Confirm the API health endpoint responds' }))

    expect(await screen.findByText('1 of 4 checks passed')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(`${BASE_URL}/health`, expect.any(Object))
  })

  it('keeps the remaining checks running when one endpoint is unreachable', async () => {
    const user = userEvent.setup()
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname
      if (path === '/health') throw new TypeError('Failed to fetch')
      const route = HEALTHY_API[path as keyof typeof HEALTHY_API]
      return new Response(route?.body === undefined ? null : JSON.stringify(route.body), {
        status: route?.status ?? 404,
      })
    })
    vi.stubGlobal('fetch', mockFetch)
    render(<SdkIntegrationChecklist baseUrl={BASE_URL} />)

    await user.click(screen.getByRole('button', { name: 'Run all checks' }))

    expect(await screen.findByText('3 of 4 checks passed')).toBeInTheDocument()
    const healthItem = screen.getByText('Confirm the API health endpoint responds').closest('li') as HTMLElement
    expect(within(healthItem).getByText(/Request failed: Failed to fetch/)).toBeInTheDocument()
  })

  it('disables the run controls while checks are in flight', async () => {
    const user = userEvent.setup()
    let release: (value: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (release = resolve))),
    )
    render(<SdkIntegrationChecklist baseUrl={BASE_URL} />)

    await user.click(screen.getByRole('button', { name: 'Run all checks' }))

    expect(screen.getByRole('button', { name: 'Run all checks' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Run check: Confirm the API health endpoint responds' })).toBeDisabled()
    release(new Response(null, { status: 200 }))
  })
})
