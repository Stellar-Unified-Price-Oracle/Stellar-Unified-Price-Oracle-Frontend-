import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { BacktestTool } from './BacktestTool'
import type { PriceHistoryEntry } from '../types'
import { PreferencesProvider } from '../preferences/PreferencesContext'

const sampleHistory: PriceHistoryEntry[] = [
  { timestamp: 1700000000000, price: 100, confidence: 0.95, sources: ['chainlink', 'redstone'] },
  { timestamp: 1700003600000, price: 102, confidence: 0.96, sources: ['chainlink', 'band'] },
]

describe('BacktestTool', () => {
  it('renders title, controls, metrics cards, and chart', () => {
    render(
      <MemoryRouter>
        <PreferencesProvider>
          <BacktestTool pair="XLM/USD" history={sampleHistory} />
        </PreferencesProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText(/Aggregation Parameter Backtester/i)).toBeInTheDocument()
    expect(screen.getByText(/Mean Deviation/i)).toBeInTheDocument()
    expect(screen.getByText(/Max Deviation/i)).toBeInTheDocument()
    expect(screen.getByText(/Outliers Filtered/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument()
  })

  it('updates parameters when mode or slider changes', () => {
    render(
      <MemoryRouter>
        <PreferencesProvider>
          <BacktestTool pair="XLM/USD" history={sampleHistory} />
        </PreferencesProvider>
      </MemoryRouter>,
    )

    const modeSelect = screen.getByLabelText(/Aggregation Mode/i) as HTMLSelectElement
    fireEvent.change(modeSelect, { target: { value: 'trimmed_mean' } })
    expect(modeSelect.value).toBe('trimmed_mean')
  })
})
