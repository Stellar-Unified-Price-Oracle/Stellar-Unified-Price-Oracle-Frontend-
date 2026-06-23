import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlertModal } from './AlertModal'
import type { Alert } from '../types'

afterEach(cleanup)

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
}

const mockAlert: Alert = {
  id: '1',
  assetPair: 'BTC/USD',
  upperThreshold: 60000,
  lowerThreshold: 40000,
  triggerOnce: false,
  active: true,
  createdAt: Date.now(),
  lastTriggeredAt: null,
}

describe('AlertModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    })
  })

  it('calls onDelete when Delete Alert is clicked', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<AlertModal {...defaultProps} alert={mockAlert} onDelete={onDelete} />)
    await user.click(screen.getByText('Delete Alert'))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('calls onSave with triggerOnce true when checkbox is checked', async () => {
    const onSave = vi.fn()
    render(<AlertModal {...defaultProps} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Asset Pair'), { target: { value: 'BTC' } })
    fireEvent.change(screen.getByLabelText('Upper Threshold'), { target: { value: '60000' } })
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByText('Create Alert'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ triggerOnce: true }),
    )
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
})
