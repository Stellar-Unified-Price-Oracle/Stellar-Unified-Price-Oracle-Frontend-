import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NETWORK_PASSPHRASES } from '../lib/networkRegistry'
import { TxReviewDialog } from './TxReviewDialog'
import type { TxSummary } from './txReview'

function summary(networkPassphrase: string): TxSummary {
  return {
    source: 'GABC',
    networkPassphrase,
    feeStroops: 100,
    feeXlm: '0.0000100',
    operations: [{ type: 'payment', destination: 'GDEST', amount: '5', asset: 'XLM' }],
  }
}

describe('TxReviewDialog network context (#845)', () => {
  afterEach(() => {
    cleanup()
  })

  it('names the network and shows its passphrase before the operations', () => {
    render(<TxReviewDialog summary={summary(NETWORK_PASSPHRASES.testnet)} onApprove={vi.fn()} onReject={vi.fn()} />)

    expect(screen.getByText('Testnet', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(NETWORK_PASSPHRASES.testnet)).toBeInTheDocument()
    expect(screen.getByText('Operations: 1')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('labels mainnet as public', () => {
    render(<TxReviewDialog summary={summary(NETWORK_PASSPHRASES.mainnet)} onApprove={vi.fn()} onReject={vi.fn()} />)

    expect(screen.getByText('Mainnet (public)', { selector: 'strong' })).toBeInTheDocument()
  })

  it('warns when the passphrase belongs to no known network', () => {
    render(<TxReviewDialog summary={summary('Some Other Network ; 2030')} onApprove={vi.fn()} onReject={vi.fn()} />)

    expect(screen.getByText('Unrecognised network', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/do not sign it/i)
  })

  it('still reports approval and rejection', async () => {
    const user = userEvent.setup()
    const onApprove = vi.fn()
    const onReject = vi.fn()
    render(<TxReviewDialog summary={summary(NETWORK_PASSPHRASES.testnet)} onApprove={onApprove} onReject={onReject} />)

    await user.click(screen.getByRole('button', { name: 'Reject' }))
    await user.click(screen.getByRole('button', { name: 'Sign' }))

    expect(onReject).toHaveBeenCalledTimes(1)
    expect(onApprove).toHaveBeenCalledTimes(1)
  })
})
