import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { FilterBar } from './FilterBar'

afterEach(cleanup)

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}

function URLDisplay() {
  const [searchParams] = useSearchParams()
  return <div data-testid="url-params">{searchParams.toString()}</div>
}

describe('FilterBar', () => {
  it('renders all filter controls', () => {
    render(<FilterBar />, { wrapper: TestWrapper })
    expect(screen.getByLabelText('Search Asset Pair')).toBeInTheDocument()
    expect(screen.getByLabelText('Confidence')).toBeInTheDocument()
    expect(screen.getByLabelText('Oracle Source')).toBeInTheDocument()
    expect(screen.getByLabelText('Sort By')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('updates URL params when typing in search', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FilterBar />
        <URLDisplay />
      </MemoryRouter>,
    )
    const searchInput = screen.getByPlaceholderText('Search by asset pair...')
    await user.type(searchInput, 'btc')
    expect(screen.getByTestId('url-params')).toHaveTextContent('search=btc')
  })

  it('updates URL params when changing confidence', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FilterBar />
        <URLDisplay />
      </MemoryRouter>,
    )
    const confidenceSelect = screen.getByLabelText('Confidence')
    await user.selectOptions(confidenceSelect, 'high')
    expect(screen.getByTestId('url-params')).toHaveTextContent('confidence=high')
  })

  it('updates URL params when changing source', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FilterBar />
        <URLDisplay />
      </MemoryRouter>,
    )
    const sourceSelect = screen.getByLabelText('Oracle Source')
    await user.selectOptions(sourceSelect, 'chainlink')
    expect(screen.getByTestId('url-params')).toHaveTextContent('source=chainlink')
  })

  it('updates URL params when changing sort', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FilterBar />
        <URLDisplay />
      </MemoryRouter>,
    )
    const sortSelect = screen.getByLabelText('Sort By')
    await user.selectOptions(sortSelect, 'price-high')
    expect(screen.getByTestId('url-params')).toHaveTextContent('sort=price-high')
  })

  it('reads initial values from URL params', () => {
    render(
      <MemoryRouter initialEntries={['/?search=xlm&confidence=high&source=redstone&sort=recent']}>
        <FilterBar />
      </MemoryRouter>,
    )
    expect(screen.getByDisplayValue('xlm')).toBeInTheDocument()
    expect(screen.getByDisplayValue('High (>80%)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Redstone')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Most Recent')).toBeInTheDocument()
  })

  it('removes URL param when clearing search', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/?search=btc']}>
        <FilterBar />
        <URLDisplay />
      </MemoryRouter>,
    )
    const searchInput = screen.getByPlaceholderText('Search by asset pair...')
    expect(searchInput).toHaveValue('btc')
    await user.clear(searchInput)
    expect(screen.getByTestId('url-params')).toHaveTextContent('')
  })

  it('clears all filters when Clear button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/?search=btc&confidence=high&source=chainlink&sort=price-low']}>
        <FilterBar />
        <URLDisplay />
      </MemoryRouter>,
    )
    const clearButton = screen.getByRole('button', { name: /clear/i })
    await user.click(clearButton)
    expect(screen.getByTestId('url-params')).toHaveTextContent('')
    expect(screen.getByPlaceholderText('Search by asset pair...')).toHaveValue('')
  })

  it('preserves other params when changing one filter', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/?search=btc&confidence=high']}>
        <FilterBar />
        <URLDisplay />
      </MemoryRouter>,
    )
    const sourceSelect = screen.getByLabelText('Oracle Source')
    await user.selectOptions(sourceSelect, 'redstone')
    const params = screen.getByTestId('url-params').textContent || ''
    expect(params).toContain('search=btc')
    expect(params).toContain('confidence=high')
    expect(params).toContain('source=redstone')
  })
})
