import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PriceDetail } from './PriceDetail'
import { useSwr } from '../hooks/useSwr'
import { usePriceHistory } from '../hooks/usePriceHistory'

vi.mock('../hooks/useSwr', () => ({
  useSwr: vi.fn(),
}))

vi.mock('../hooks/usePriceHistory', () => ({
  usePriceHistory: vi.fn(),
}))

const mockedUseSwr = vi.mocked(useSwr)
const mockedUsePriceHistory = vi.mocked(usePriceHistory)

describe('PriceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseSwr.mockReturnValue({
      data: undefined,
      error: null,
      loading: false,
      isValidating: false,
      refetch: vi.fn(),
    })
    mockedUsePriceHistory.mockReturnValue({
      history: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadMore: vi.fn(),
    })
  })

  it('shows an error message when the price request fails', () => {
    mockedUseSwr.mockReturnValue({
      data: undefined,
      error: 'Failed to load price',
      loading: false,
      isValidating: false,
      refetch: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/price/BTC%2FUSD']}>
        <Routes>
          <Route path="/price/:pair" element={<PriceDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Failed to load price')).toBeInTheDocument()
  })

  it('shows an empty state when no price data is available', () => {
    render(
      <MemoryRouter initialEntries={['/price/BTC%2FUSD']}>
        <Routes>
          <Route path="/price/:pair" element={<PriceDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('No price data available for this pair.')).toBeInTheDocument()
  })
})
