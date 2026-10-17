import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { config } from '../config'
import { AuthProvider, useAuth } from './AuthContext'
import { SessionExpiredBanner } from './SessionExpiredBanner'
import { checkSession } from './authApi'

vi.mock('./authApi', () => ({
  checkSession: vi.fn(),
  exchangeCode: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  signOutEverywhere: vi.fn().mockResolvedValue(undefined),
}))

const USER = { id: 'u1', name: 'Ada', email: null, avatarUrl: null, provider: 'github' as const }
const AUTHENTICATED = { state: 'authenticated', user: USER } as const
const EXPIRED = { state: 'expired' } as const
const UNAVAILABLE = { state: 'unavailable' } as const

function Probe() {
  const { status, sessionExpired, dismissSessionExpired, signOut } = useAuth()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="expired">{String(sessionExpired)}</p>
      <button type="button" onClick={dismissSessionExpired}>
        dismiss
      </button>
      <button type="button" onClick={() => void signOut()}>
        sign out
      </button>
    </div>
  )
}

/** Advances past one session-check interval and lets the resulting state settle. */
async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(config.auth.sessionCheckIntervalMs)
  })
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

describe('AuthProvider session expiry (#844)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(checkSession).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flags an expiry when a signed-in session is rejected by the server', async () => {
    vi.mocked(checkSession).mockResolvedValueOnce(AUTHENTICATED).mockResolvedValue(EXPIRED)
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await settle()
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')

    await tick()

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('expired')).toHaveTextContent('true')
  })

  it('does not flag an expiry for a visitor who was never signed in', async () => {
    vi.mocked(checkSession).mockResolvedValue(EXPIRED)
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await settle()
    await tick()

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('expired')).toHaveTextContent('false')
  })

  it('keeps the signed-in state when a session check cannot complete', async () => {
    vi.mocked(checkSession).mockResolvedValueOnce(AUTHENTICATED).mockResolvedValue(UNAVAILABLE)
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await settle()
    await tick()

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('expired')).toHaveTextContent('false')
  })

  it('settles the initial load to unauthenticated when the first check cannot complete', async () => {
    vi.mocked(checkSession).mockResolvedValue(UNAVAILABLE)
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await settle()

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('expired')).toHaveTextContent('false')
  })

  it('does not flag an expiry after an explicit sign-out', async () => {
    vi.mocked(checkSession).mockResolvedValueOnce(AUTHENTICATED).mockResolvedValue(EXPIRED)
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await settle()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'sign out' }))
    })
    await tick()

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('expired')).toHaveTextContent('false')
  })

  it('clears the expiry flag when the user dismisses it', async () => {
    vi.mocked(checkSession).mockResolvedValueOnce(AUTHENTICATED).mockResolvedValue(EXPIRED)
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await settle()
    await tick()
    expect(screen.getByTestId('expired')).toHaveTextContent('true')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    })

    expect(screen.getByTestId('expired')).toHaveTextContent('false')
  })
})

describe('SessionExpiredBanner (#844)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(checkSession).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing outside an AuthProvider', () => {
    const { container } = render(
      <MemoryRouter>
        <SessionExpiredBanner />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('warns about possible loss of unsaved work and offers sign-in when the session expires', async () => {
    vi.mocked(checkSession).mockResolvedValueOnce(AUTHENTICATED).mockResolvedValue(EXPIRED)
    render(
      <MemoryRouter initialEntries={['/developer/settings']}>
        <AuthProvider>
          <SessionExpiredBanner />
        </AuthProvider>
      </MemoryRouter>,
    )
    await settle()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await tick()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/may be lost/)
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })
})
