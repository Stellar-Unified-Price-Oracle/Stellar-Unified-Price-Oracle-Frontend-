import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { PriceHistoryEntry } from '../types'
import { ComparisonSummary } from './ComparisonSummary'

const point = (timestamp: number, price: number): PriceHistoryEntry => ({
  timestamp,
  price,
  confidence: 0.99,
  sources: ['chainlink'],
})

const history = {
  'BTC/USD': [point(1000, 100), point(2000, 150)],
}

describe('ComparisonSummary', () => {
  it('shows one row per selected pair with its change over the window', () => {
    render(<ComparisonSummary pairs={['BTC/USD']} history={history} />)
    const table = screen.getByRole('table', { name: 'Per-pair summary for the selected window' })
    const row = within(table)
      .getByRole('rowheader', { name: /BTC\/USD/ })
      .closest('tr') as HTMLElement
    expect(within(row).getByText('+50.00%')).toBeInTheDocument()
  })

  it('keeps a pair with no data in the window and labels it', () => {
    render(<ComparisonSummary pairs={['BTC/USD', 'ETH/USD']} history={history} />)
    expect(screen.getByText('no data in window')).toBeInTheDocument()
  })

  it('shows a window and states that nothing is observed when no pair has data', () => {
    render(<ComparisonSummary pairs={['ETH/USD']} history={history} />)
    expect(screen.getByText('No observations in the selected window.')).toBeInTheDocument()
  })

  it('restricts the rows to the given start and end', () => {
    render(<ComparisonSummary pairs={['BTC/USD']} history={history} start={1500} end={2500} />)
    const table = screen.getByRole('table', { name: 'Per-pair summary for the selected window' })
    const row = within(table)
      .getByRole('rowheader', { name: /BTC\/USD/ })
      .closest('tr') as HTMLElement
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('1')
  })
})
