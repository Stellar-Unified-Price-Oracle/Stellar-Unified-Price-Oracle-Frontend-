import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NETWORK_PASSPHRASES } from '../lib/networkRegistry'
import { TxReviewDialog } from './TxReviewDialog'
import type { TxSummary } from './txReview'

function summaryFor(networkPassphrase: string): TxSummary {
  return {
    source: 'GSOURCE',
    networkPassphrase,
    feeStroops: 100,
    feeXlm: '0.0000100',
    operations: [{ type: 'payment', destination: 'GDEST', amount: '1', asset: 'XLM' }],
  }
}

describe('TxReviewDialog network context', () => {
  afterEach(cleanup)

  it('names the network the transaction targets before signing', () => {
    render(<TxReviewDialog summary={summaryFor(NETWORK_PASSPHRASES.testnet)} onApprove={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText(/Network:/).textContent).toContain('testnet')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('warns when the passphrase does not match a known network', () => {
    render(<TxReviewDialog summary={summaryFor('some unknown passphrase')} onApprove={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText(/Unknown network/)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Do not sign it')
  })

  it('still lets the user reject or approve', async () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    render(
      <TxReviewDialog summary={summaryFor(NETWORK_PASSPHRASES.testnet)} onApprove={onApprove} onReject={onReject} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Sign' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(onApprove).toHaveBeenCalledTimes(1)
    expect(onReject).toHaveBeenCalledTimes(1)
  })
})
