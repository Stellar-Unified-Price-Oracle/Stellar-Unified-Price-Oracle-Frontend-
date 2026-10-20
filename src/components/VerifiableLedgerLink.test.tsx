import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { VerifiableLedgerLink } from './VerifiableLedgerLink'

afterEach(cleanup)

describe('VerifiableLedgerLink', () => {
  it('renders a verified ledger link on testnet', () => {
    render(
      <VerifiableLedgerLink
        claimType="ledger"
        identifier={543210}
        network="testnet"
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/testnet/ledger/543210')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveTextContent('Ledger #543,210')
  })

  it('renders a verified contract link on mainnet with truncated display', () => {
    const contractId = 'C' + 'A'.repeat(55)
    render(
      <VerifiableLedgerLink
        claimType="contract"
        identifier={contractId}
        network="mainnet"
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `https://stellar.expert/explorer/public/contract/${contractId}`)
    expect(link).toHaveTextContent(/CAAAAA…AAAA/)
  })

  it('renders a verified account link with custom label', () => {
    const accountId = 'G' + 'B'.repeat(55)
    render(
      <VerifiableLedgerLink
        claimType="account"
        identifier={accountId}
        network="testnet"
        label="Treasury Safe"
      />,
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `https://stellar.expert/explorer/testnet/account/${accountId}`)
    expect(link).toHaveTextContent('Treasury Safe')
  })

  it('renders fallback text when identifier is null or empty', () => {
    render(
      <VerifiableLedgerLink
        claimType="ledger"
        identifier={null}
        fallbackText="Not recorded"
      />,
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Not recorded')).toBeInTheDocument()
  })

  it('renders fallback text when identifier is invalid for the claim type', () => {
    render(
      <VerifiableLedgerLink
        claimType="ledger"
        identifier="not-a-number"
        fallbackText="Invalid sequence"
      />,
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Invalid sequence')).toBeInTheDocument()
  })

  it('includes screen-reader description for accessibility', () => {
    render(
      <VerifiableLedgerLink
        claimType="tx"
        identifier={'f'.repeat(64)}
        network="testnet"
      />,
    )
    expect(screen.getByText(/verifiable on-chain record on stellar\.expert/)).toBeInTheDocument()
  })
})
