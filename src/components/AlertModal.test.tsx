import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreferencesProvider } from '../preferences/PreferencesContext'
import { makeAlert } from '../test/fixtures'
import { checkAccessibility } from '../test/accessibility'
import { saveBotSecrets } from '../services/botNotifications'
import { STORAGE_KEYS, writeJson } from '../utils/storage'
import { AlertModal } from './AlertModal'

const render = (ui: Parameters<typeof rtlRender>[0], options?: Parameters<typeof rtlRender>[1]) =>
  rtlRender(ui, { wrapper: PreferencesProvider, ...options })

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
}

const mockAlert = makeAlert({ id: '1', lowerThreshold: 40000 })

describe('AlertModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('should have no accessibility violations when open', async () => {
    await checkAccessibility(
      <PreferencesProvider>
        <AlertModal {...defaultProps} />
      </PreferencesProvider>,
    )
  })

  it('renders nothing when closed', () => {
    const { container } = render(<AlertModal {...defaultProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders create mode by default', () => {
    render(<AlertModal {...defaultProps} />)
    expect(screen.getByText('New Price Alert')).toBeInTheDocument()
    expect(screen.getByText('Create Alert')).toBeInTheDocument()
    expect(screen.getByLabelText('Asset Pair')).toBeInTheDocument()
    expect(screen.getByLabelText('Upper Threshold')).toBeInTheDocument()
    expect(screen.getByLabelText('Lower Threshold')).toBeInTheDocument()
  })

  it('renders edit mode when alert is provided', () => {
    render(<AlertModal {...defaultProps} alert={mockAlert} onDelete={vi.fn()} />)
    expect(screen.getByText('Edit Alert')).toBeInTheDocument()
    expect(screen.getByText('Save Changes')).toBeInTheDocument()
    expect(screen.getByText('Delete Alert')).toBeInTheDocument()
    expect(screen.getByDisplayValue('BTC/USD')).toBeInTheDocument()
    expect(screen.getByDisplayValue('60000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('40000')).toBeInTheDocument()
  })

  it('disables asset pair input in edit mode', () => {
    render(<AlertModal {...defaultProps} alert={mockAlert} />)
    expect(screen.getByLabelText('Asset Pair')).toBeDisabled()
  })

  it('calls onClose when clicking backdrop', async () => {
    const user = userEvent.setup()
    render(<AlertModal {...defaultProps} />)
    await user.click(document.querySelector('.fixed.inset-0')!)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when pressing Escape', async () => {
    const user = userEvent.setup()
    render(<AlertModal {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    dialog.focus()
    await user.keyboard('{Escape}')
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking Cancel', async () => {
    const user = userEvent.setup()
    render(<AlertModal {...defaultProps} />)
    await user.click(screen.getByText('Cancel'))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('shows validation error when no thresholds provided', async () => {
    render(<AlertModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'BTC/USD' } })
    const user = userEvent.setup()
    await user.click(screen.getByText('Create Alert'))
    const errors = screen.getAllByText('At least one threshold is required')
    expect(errors).toHaveLength(2)
  })

  it('shows validation error for negative upper threshold', async () => {
    render(<AlertModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'BTC/USD' } })
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '-100' } })
    const user = userEvent.setup()
    await user.click(screen.getByText('Create Alert'))
    expect(screen.getByText('Must be a positive number')).toBeInTheDocument()
  })

  it('shows validation error when upper <= lower', async () => {
    render(<AlertModal {...defaultProps} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'BTC/USD' } })
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Lower Threshold'), { target: { value: '200' } })
    const user = userEvent.setup()
    await user.click(screen.getByText('Create Alert'))
    const errors = screen.getAllByRole('alert')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('calls onSave with valid data', async () => {
    const onSave = vi.fn()
    render(<AlertModal {...defaultProps} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'BTC' } })
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '60000' } })
    const user = userEvent.setup()
    await user.click(screen.getByText('Create Alert'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      assetPair: 'BTC',
      upperThreshold: '60000',
      lowerThreshold: '',
      triggerOnce: false,
      percentageMode: false,
      percentageThreshold: '',
      percentageWindow: '1hr',
      percentageDirection: 'either',
      percentageRelativeTo: 'open',
      cooldownMinutes: '5',
      extraConditions: [],
      conditionsLogic: 'AND',
      escalationEnabled: false,
      escalationSteps: [],
      channels: [],
      notifyOnRecovery: false,
      retestMode: false,
      expiryDate: '',
      reviewDate: '',
    })
  })

  it('calls onSave with lower threshold only', async () => {
    const onSave = vi.fn()
    render(<AlertModal {...defaultProps} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'ETH' } })
    fireEvent.change(screen.getByLabelText('Lower Threshold'), { target: { value: '2000' } })
    const user = userEvent.setup()
    await user.click(screen.getByText('Create Alert'))
    expect(onSave).toHaveBeenCalledWith({
      assetPair: 'ETH',
      upperThreshold: '',
      lowerThreshold: '2000',
      triggerOnce: false,
      percentageMode: false,
      percentageThreshold: '',
      percentageWindow: '1hr',
      percentageDirection: 'either',
      percentageRelativeTo: 'open',
      cooldownMinutes: '5',
      extraConditions: [],
      conditionsLogic: 'AND',
      escalationEnabled: false,
      escalationSteps: [],
      channels: [],
      notifyOnRecovery: false,
      retestMode: false,
      expiryDate: '',
      reviewDate: '',
    })
  })

  it('calls onDelete when Delete Alert is clicked', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<AlertModal {...defaultProps} alert={mockAlert} onDelete={onDelete} />)
    await user.click(screen.getByText('Delete Alert'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('calls onSave with triggerOnce true when One-Time is selected', async () => {
    const onSave = vi.fn()
    render(<AlertModal {...defaultProps} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'BTC' } })
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '60000' } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /one-time/i }))
    await user.click(screen.getByText('Create Alert'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ triggerOnce: true }))
  })

  it('saves the recovery-notification preference', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<AlertModal {...defaultProps} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'BTC' } })
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '60000' } })
    await user.click(screen.getByRole('checkbox', { name: 'Notify when condition clears' }))
    await user.click(screen.getByText('Create Alert'))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ notifyOnRecovery: true }))
  })

  it('has accessible dialog role and label', () => {
    render(<AlertModal {...defaultProps} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Create price alert')
  })

  it('shows percentage suggestion buttons when currentPrice provided', () => {
    render(<AlertModal {...defaultProps} currentPrice={50000} />)
    expect(screen.getByText('+5%')).toBeInTheDocument()
    expect(screen.getByText('+10%')).toBeInTheDocument()
    expect(screen.getByText('-5%')).toBeInTheDocument()
    expect(screen.getByText('-10%')).toBeInTheDocument()
  })

  it('fills upper threshold from suggestion button', async () => {
    const user = userEvent.setup()
    render(<AlertModal {...defaultProps} currentPrice={50000} />)
    await user.click(screen.getByText('+10%'))
    expect(screen.getByLabelText('Upper Threshold')).toHaveValue(55000)
  })

  it('fills lower threshold from suggestion button', async () => {
    const user = userEvent.setup()
    render(<AlertModal {...defaultProps} currentPrice={50000} />)
    await user.click(screen.getByText('-5%'))
    expect(screen.getByLabelText('Lower Threshold')).toHaveValue(47500)
  })

  it('has close button with accessible label', () => {
    render(<AlertModal {...defaultProps} />)
    expect(screen.getByLabelText('Close modal')).toBeInTheDocument()
  })

  it('submits optional expiry and review dates', async () => {
    const onSave = vi.fn()
    const user = userEvent.setup()
    render(<AlertModal {...defaultProps} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'BTC' } })
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '60000' } })
    fireEvent.change(screen.getByLabelText('Expiry date (optional)'), { target: { value: '2030-04-05' } })
    fireEvent.change(screen.getByLabelText('Review reminder (optional)'), { target: { value: '2030-05-06' } })
    await user.click(screen.getByText('Create Alert'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ expiryDate: '2030-04-05', reviewDate: '2030-05-06' }))
  })

  it('blocks saving until a selected channel is locally ready, then refreshes on focus', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    writeJson(STORAGE_KEYS.notificationChannels, {
      email: { address: '', enabled: false },
      webPush: { enabled: false },
      webhook: { url: '', enabled: false },
      telegram: { chatId: 'chat-1', enabled: true },
      discord: { channelId: '', enabled: false },
    })
    render(<AlertModal {...defaultProps} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'BTC' } })
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '60000' } })
    await user.click(screen.getByRole('button', { name: 'Telegram' }))

    const createButton = screen.getByRole('button', { name: 'Create Alert' })
    expect(createButton).toBeDisabled()
    expect(screen.getByText('Session-only secret is missing; re-enter it in notification settings')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()

    saveBotSecrets({ telegramBotToken: 'session-token', discordWebhookUrl: '' })
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(createButton).toBeEnabled())
    await user.click(createButton)

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ channels: ['telegram'] }))
  })
})

describe('snapshots', () => {
  it('create mode', () => {
    const { container } = render(<AlertModal {...defaultProps} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('edit mode', () => {
    const { container } = render(<AlertModal {...defaultProps} alert={mockAlert} onDelete={vi.fn()} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('with suggestions', () => {
    const { container } = render(<AlertModal {...defaultProps} currentPrice={50000} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
