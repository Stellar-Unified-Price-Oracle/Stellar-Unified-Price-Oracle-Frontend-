import { describe, it, expect, afterEach } from 'vitest'
import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { checkAccessibility } from '../test/accessibility'
import { WS_PROTOCOL_VERSION } from '../api/version'
import { ConnectionBadge } from './ConnectionBadge'

afterEach(cleanup)

describe('ConnectionBadge', () => {
  it('should have no accessibility violations', async () => {
    await checkAccessibility(<ConnectionBadge status="connected" />)
  })

  it('renders connected status', () => {
    render(<ConnectionBadge status="connected" />)
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'WebSocket Live')
  })

  it('shows the fallback path and reason', () => {
    render(<ConnectionBadge status="connected" diagnostics={{
      retryCount: 0, lastConnectedAt: null, totalDisconnections: 0,
      transport: 'sse', transportPath: ['ws', 'sse'], fallbackReason: 'websocket-retries-exhausted',
    }} />)
    expect(screen.getByText('WS → SSE')).toBeVisible()
    expect(screen.getByText('WebSocket retries exhausted')).toBeVisible()
  })

  it('renders connecting status', () => {
    render(<ConnectionBadge status="connecting" />)
    expect(screen.getByText('Connecting')).toBeInTheDocument()
  })

  it('renders reconnecting status', () => {
    render(<ConnectionBadge status="reconnecting" />)
    expect(screen.getByText('Reconnecting')).toBeInTheDocument()
  })

  it('renders disconnected status', () => {
    render(<ConnectionBadge status="disconnected" />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('surfaces reconnect cause details and category totals accessibly', () => {
    render(
      <ConnectionBadge
        status="reconnecting"
        diagnostics={{
          retryCount: 1,
          lastConnectedAt: null,
          totalDisconnections: 3,
          lastReconnectCause: { type: 'server', timestamp: 1, closeCode: 1011, closeReason: 'maintenance' },
          reconnectCauseCounts: { network: 1, browser: 1, server: 1, unknown: 0 },
        }}
      />,
    )
    expect(screen.getByText('Network 1 · Browser 1 · Server response 1')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Last reconnect cause: server response (close code 1011) — maintenance'),
    )
  })

  it('renders rate limited status with countdown', () => {
    render(<ConnectionBadge status="connected" rateLimitStatus="limited" retryAfterMs={15000} />)
    expect(screen.getByText('Rate limited (15s)')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'API rate limited')
  })

  it('renders rate limited status without retry info', () => {
    render(<ConnectionBadge status="connected" rateLimitStatus="limited" />)
    expect(screen.getByText('Rate limited')).toBeInTheDocument()
  })

  it('surfaces a protocol compatibility error with recovery guidance', async () => {
    const badge = (
      <ConnectionBadge
        status="connected"
        diagnostics={{
          retryCount: 0,
          lastConnectedAt: Date.now(),
          totalDisconnections: 0,
          protocolVersion: WS_PROTOCOL_VERSION + 1,
          protocolUpgradeRequired: true,
        }}
      />
    )
    render(badge)

    const status = screen.getByRole('status')
    expect(screen.getByText('Update client')).toBeInTheDocument()
    expect(status.getAttribute('aria-label')).toContain(
      `Server v${WS_PROTOCOL_VERSION + 1}, client v${WS_PROTOCOL_VERSION}`,
    )
    fireEvent.focus(status.parentElement!)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Update the frontend to a compatible release and reload')
    expect(screen.getByRole('tooltip')).toHaveTextContent('REST remains available')
    await checkAccessibility(badge)
  })
})

describe('snapshots', () => {
  it('connected', () => {
    const { container } = render(<ConnectionBadge status="connected" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('connecting', () => {
    const { container } = render(<ConnectionBadge status="connecting" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('reconnecting', () => {
    const { container } = render(<ConnectionBadge status="reconnecting" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('disconnected', () => {
    const { container } = render(<ConnectionBadge status="disconnected" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('rate limited', () => {
    const { container } = render(<ConnectionBadge status="connected" rateLimitStatus="limited" retryAfterMs={10000} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
