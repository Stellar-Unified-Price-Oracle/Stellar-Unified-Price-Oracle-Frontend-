import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { makeAlert } from '../test/fixtures'
import { localDateToTimestamp } from '../utils/alertLifecycle'
import { deliveryTracker } from '../services/deliveryReceipts'
import { AlertPanel, DeliveryAttempts } from './AlertPanel'

const render = (ui: Parameters<typeof rtlRender>[0], options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, { wrapper: PreferencesProvider, ...options })

const mocks = vi.hoisted(() => ({
  useAlerts: vi.fn(),
  useAlertHealth: vi.fn(() => ({ flags: [], dismiss: vi.fn() })),
}))

vi.mock('../hooks/useAlerts', () => ({ useAlerts: mocks.useAlerts }))
vi.mock('../hooks/useAlertHealth', () => ({ useAlertHealth: mocks.useAlertHealth }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      Object.entries(values ?? {}).reduce((text, [name, value]) => text.replace(`{{${name}}}`, String(value)), key),
  }),
}))
vi.mock('./AlertHistoryLog', () => ({ AlertHistoryLog: () => null }))
vi.mock('./AlertAnalyticsStrip', () => ({ AlertAnalyticsStrip: () => null }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Alert delivery attempts', () => {
  it('shows the empty state and updates with each retry outcome', async () => {
    const alertId = 'delivery-attempts-component-test'
    render(<DeliveryAttempts alertId={alertId} />)
    expect(screen.getByText('alertPanel.delivery.empty')).toBeInTheDocument()

    let calls = 0
    await act(async () => {
      await deliveryTracker.deliver(alertId, 'email', async () => {
        calls += 1
        return calls === 1 ? { ok: false, status: 503 } : { ok: true, status: 202 }
      })
    })

    expect(calls).toBe(2)
    expect(screen.getByRole('region', { name: 'alertPanel.delivery.title' })).toBeInTheDocument()
    expect(screen.getByText('alertPanel.delivery.status_delivered')).toBeInTheDocument()
    expect(screen.getByText(/alertPanel\.delivery\.attemptFailed/)).toBeInTheDocument()
    expect(screen.getByText(/alertPanel\.delivery\.attemptDelivered/)).toBeInTheDocument()
  })
})

function renderPanel(
  alerts = [makeAlert({ id: 'a', assetPair: 'BTC/USD' }), makeAlert({ id: 'b', assetPair: 'ETH/USD' })],
) {
  const updateAlerts = vi.fn()
  const updateAlert = vi.fn()
  mocks.useAlerts.mockReturnValue({
    alerts,
    alertHistory: [],
    removeAlert: vi.fn(),
    updateAlert,
    updateAlerts,
    markAsRead: vi.fn(),
    isPanelOpen: true,
    togglePanel: vi.fn(),
    snoozeAlert: vi.fn(),
    unsnoozeAlert: vi.fn(),
    reEnableAlert: vi.fn(),
  })
  render(<AlertPanel />)
  return { updateAlerts, updateAlert }
}

describe('AlertPanel bulk rule actions', () => {
  it('supports keyboard selection and pauses every selected rule together', async () => {
    const user = userEvent.setup()
    const { updateAlerts } = renderPanel()

    const summary = screen.getByText('alertPanel.bulk.selectRules', { selector: 'summary' })
    summary.focus()
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('button', { name: 'alertPanel.bulk.selectAll' }))
    await user.click(screen.getByRole('button', { name: 'alertPanel.bulk.pause' }))

    expect(updateAlerts).toHaveBeenCalledWith(['a', 'b'], { active: false })
    expect(screen.getByRole('checkbox', { name: 'BTC/USD' })).toBeChecked()
  })

  it('bulk-edits only the checked lifecycle fields', async () => {
    const user = userEvent.setup()
    const { updateAlerts } = renderPanel()

    const summary = screen.getByText('alertPanel.bulk.selectRules', { selector: 'summary' })
    await user.click(summary)
    await user.click(screen.getByLabelText('BTC/USD'))
    await user.click(screen.getByRole('button', { name: 'alertPanel.bulk.editDates' }))
    await user.click(screen.getByLabelText('alertPanel.bulk.applyExpiry'))
    fireEvent.change(screen.getByLabelText('alertModal.lifecycle.expiryLabel'), { target: { value: '2030-04-05' } })
    await user.click(screen.getByRole('button', { name: 'alertPanel.bulk.saveDates' }))

    expect(updateAlerts).toHaveBeenCalledWith(['a'], { expiresAt: localDateToTimestamp('2030-04-05', true) })
  })

  it('archives selected rules and offers a paused restore action', async () => {
    const user = userEvent.setup()
    const { updateAlerts } = renderPanel()

    await user.click(screen.getByText('alertPanel.bulk.selectRules', { selector: 'summary' }))
    await user.click(screen.getByLabelText('BTC/USD'))
    await user.click(screen.getByRole('button', { name: 'alertPanel.bulk.archive' }))
    expect(updateAlerts).toHaveBeenCalledWith(['a'], { archived: true, active: false })
  })

  it('restores archived rules paused', async () => {
    const user = userEvent.setup()
    const { updateAlert } = renderPanel([makeAlert({ id: 'archived', archived: true })])
    await user.click(screen.getByRole('tab', { name: 'alertPanel.tabs.archived' }))
    await user.click(screen.getByRole('button', { name: 'alertPanel.bulk.restore' }))
    expect(updateAlert).toHaveBeenCalledWith('archived', { archived: false, active: false })
  })
})
