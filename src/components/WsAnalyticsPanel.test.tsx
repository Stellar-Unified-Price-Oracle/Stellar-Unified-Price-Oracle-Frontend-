import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkAccessibility } from '../test/accessibility'
import { WsAnalyticsPanel } from './WsAnalyticsPanel'
import { wsAnalytics } from '../utils/wsAnalytics'

afterEach(() => {
  cleanup()
  wsAnalytics.clear()
})

describe('WsAnalyticsPanel', () => {
  it('has no accessibility violations', async () => {
    await checkAccessibility(<WsAnalyticsPanel />)
  })

  it('renders lifetime counters from wsAnalytics', () => {
    wsAnalytics.recordConnect()
    wsAnalytics.recordError('boom')
    render(<WsAnalyticsPanel />)
    expect(screen.getByText('Connects').previousSibling).toHaveTextContent('1')
    expect(screen.getByText('Errors').previousSibling).toHaveTextContent('1')
  })

  it('renders real message/byte/drop counters (#473)', () => {
    wsAnalytics.recordMessage(1024, 12)
    wsAnalytics.recordMessage(512, 8)
    wsAnalytics.recordDrop('malformed')
    render(<WsAnalyticsPanel />)
    expect(screen.getByText('Messages').nextSibling).toHaveTextContent('2')
    expect(screen.getByText('Dropped frames').nextSibling).toHaveTextContent('1')
    expect(screen.getByText('Data received').nextSibling).toHaveTextContent('1.5 KB')
  })

  it('renders latency percentiles computed from real samples', () => {
    for (let i = 1; i <= 100; i++) wsAnalytics.recordMessage(10, i)
    render(<WsAnalyticsPanel />)
    expect(screen.getByText('p50').nextSibling).toHaveTextContent('50.0ms')
    expect(screen.getByText('p95').nextSibling).toHaveTextContent('95.0ms')
    expect(screen.getByText('p99').nextSibling).toHaveTextContent('99.0ms')
  })

  it('shows an em-dash for percentiles before any messages are recorded', () => {
    render(<WsAnalyticsPanel />)
    expect(screen.getByText('p50').nextSibling).toHaveTextContent('—')
  })

  it('renders a fixed-size sparkline container regardless of data volume (CLS = 0)', () => {
    const { container: empty } = render(<WsAnalyticsPanel />)
    const emptyBox = empty.querySelector('svg')!.parentElement!
    const emptyHeight = emptyBox.getAttribute('style')

    cleanup()
    for (let i = 0; i < 50; i++) wsAnalytics.recordMessage(10, 1)
    const { container: full } = render(<WsAnalyticsPanel />)
    const fullBox = full.querySelector('svg')!.parentElement!

    expect(fullBox.getAttribute('style')).toBe(emptyHeight)
  })

  it('reflects live updates when wsAnalytics records a new message', async () => {
    render(<WsAnalyticsPanel />)
    expect(screen.getByText('Messages').nextSibling).toHaveTextContent('0')

    wsAnalytics.recordMessage(10, 1)
    // Message notifications are throttled (~250ms) — wait for the coalesced update.
    await waitFor(() => {
      expect(screen.getByText('Messages').nextSibling).toHaveTextContent('1')
    })
  })

  describe('export diagnostics button', () => {
    let createObjectURLSpy: ReturnType<typeof vi.fn>
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      createObjectURLSpy = vi.fn(() => 'blob:test')
      revokeObjectURLSpy = vi.fn()
      URL.createObjectURL = createObjectURLSpy as typeof URL.createObjectURL
      URL.revokeObjectURL = revokeObjectURLSpy as typeof URL.revokeObjectURL
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('downloads a full diagnostics snapshot via the shared export tooling', async () => {
      let capturedContent = ''
      let capturedType = ''
      class BlobMock {
        readonly type: string
        constructor(parts: BlobPart[] = [], options: BlobPropertyBag = {}) {
          capturedContent = String(parts[0])
          capturedType = options.type ?? ''
          this.type = capturedType
        }
      }
      vi.stubGlobal('Blob', BlobMock)

      wsAnalytics.recordConnect()
      wsAnalytics.recordMessage(100, 5)
      const user = userEvent.setup()
      render(<WsAnalyticsPanel />)

      await user.click(screen.getByRole('button', { name: 'Export diagnostics' }))

      await waitFor(() => expect(createObjectURLSpy).toHaveBeenCalled())
      expect(capturedType).toBe('application/json')
      const parsed = JSON.parse(capturedContent)
      expect(parsed.summary.totalConnects).toBe(1)
      expect(parsed.summary.totalMessages).toBe(1)
    })
  })
})
