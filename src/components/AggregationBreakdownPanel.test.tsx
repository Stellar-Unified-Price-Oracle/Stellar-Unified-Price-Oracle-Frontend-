import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AggregationBreakdownPanel } from './AggregationBreakdownPanel'
import type { AggregationBreakdown } from '../types/price'

const mockBreakdown: AggregationBreakdown = {
  assetPair: 'XLM/USD',
  mode: 'weighted_mean',
  params: {},
  sources: [
    { source: 'chainlink', price: 0.1215, weight: 0.5, contribution: 0.06075, excluded: false },
    { source: 'redstone', price: 0.1205, weight: 0.5, contribution: 0.06025, excluded: false },
  ],
  aggregatePrice: 0.121,
}

const outlierBreakdown: AggregationBreakdown = {
  assetPair: 'XLM/USD',
  mode: 'outlier_excluded',
  params: { zScoreThreshold: 1.5 },
  sources: [
    { source: 'chainlink', price: 0.1215, weight: 1, contribution: 0.1215, excluded: false },
    { source: 'redstone', price: 0.09, weight: 0, contribution: 0, excluded: true },
  ],
  aggregatePrice: 0.1215,
}

describe('AggregationBreakdownPanel', () => {
  it('renders source names in the table', () => {
    render(<AggregationBreakdownPanel breakdown={mockBreakdown} />)
    expect(screen.getByText('chainlink')).toBeTruthy()
    expect(screen.getByText('redstone')).toBeTruthy()
  })

  it('displays the weighted mean mode badge', () => {
    render(<AggregationBreakdownPanel breakdown={mockBreakdown} />)
    expect(screen.getByText('Weighted Mean')).toBeTruthy()
  })

  it('displays the aggregate price in the footer row', () => {
    render(<AggregationBreakdownPanel breakdown={mockBreakdown} />)
    // Aggregate label appears in tfoot
    expect(screen.getByText('Aggregate')).toBeTruthy()
  })

  it('shows excluded badge for outlier sources', () => {
    render(<AggregationBreakdownPanel breakdown={outlierBreakdown} />)
    expect(screen.getByText('excluded')).toBeTruthy()
  })

  it('shows the outlier-excluded mode badge and z-score param', () => {
    render(<AggregationBreakdownPanel breakdown={outlierBreakdown} />)
    expect(screen.getByText('Outlier-Excluded Mean')).toBeTruthy()
    expect(screen.getByText(/z-score threshold: 1.5/)).toBeTruthy()
  })

  it('shows the excluded count notice', () => {
    render(<AggregationBreakdownPanel breakdown={outlierBreakdown} />)
    expect(screen.getByText(/1 source excluded as outlier/)).toBeTruthy()
  })

  it('toggles calculation steps on button click', async () => {
    render(<AggregationBreakdownPanel breakdown={mockBreakdown} />)
    const btn = screen.getByRole('button', { name: /show calculation steps/i })
    expect(screen.queryByText('Calculation steps')).toBeNull()
    await userEvent.click(btn)
    expect(screen.getByText('Calculation steps')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /hide calculation steps/i }))
    expect(screen.queryByText('Calculation steps')).toBeNull()
  })

  it('does not render calculation steps for median mode', () => {
    const medianBreakdown: AggregationBreakdown = {
      ...mockBreakdown,
      mode: 'median',
    }
    render(<AggregationBreakdownPanel breakdown={medianBreakdown} />)
    expect(screen.queryByRole('button', { name: /calculation steps/i })).toBeNull()
  })

  it('renders contribution progress bars', () => {
    render(<AggregationBreakdownPanel breakdown={mockBreakdown} />)
    const bars = screen.getAllByRole('progressbar')
    expect(bars.length).toBe(2)
  })
})
