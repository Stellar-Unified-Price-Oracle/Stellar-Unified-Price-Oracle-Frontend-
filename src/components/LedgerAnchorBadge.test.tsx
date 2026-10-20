import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LedgerAnchorBadge } from './LedgerAnchorBadge'
import type { LedgerAnchor } from '../lib/chainTip'

afterEach(cleanup)

describe('LedgerAnchorBadge', () => {
  it('returns null when anchor is undefined', () => {
    const { container } = render(<LedgerAnchorBadge anchor={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a verified ledger link for confirmed anchor', () => {
    const anchor: LedgerAnchor = {
      sequence: 654321,
      ledgerHash: 'hash-abc',
      status: 'confirmed',
    }
    render(<LedgerAnchorBadge anchor={anchor} network="testnet" />)

    const badge = screen.getByTestId('ledger-anchor')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('title', 'Ledger hash hash-abc')

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/testnet/ledger/654321')
    expect(link).toHaveTextContent('Ledger #654321')
    expect(screen.queryByText(/reorged/)).toBeNull()
  })

  it('renders reorg warning when anchor status is reorged', () => {
    const anchor: LedgerAnchor = {
      sequence: 654321,
      ledgerHash: 'hash-reorged',
      status: 'reorged',
    }
    render(<LedgerAnchorBadge anchor={anchor} network="testnet" />)

    expect(screen.getByText('(reorged: re-verify)')).toBeInTheDocument()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://stellar.expert/explorer/testnet/ledger/654321')
  })
})
