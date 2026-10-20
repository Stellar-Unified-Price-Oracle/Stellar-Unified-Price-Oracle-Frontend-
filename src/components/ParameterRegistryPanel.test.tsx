import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ParameterRecord } from '../types'
import { ParameterRegistryPanel } from './ParameterRegistryPanel'

const NOW = 1_700_000_000_000

function makeRecord(overrides: Partial<ParameterRecord> = {}): ParameterRecord {
  return {
    key: 'aggregator.minSources',
    label: 'Minimum sources',
    category: 'aggregation',
    currentValue: '3',
    owner: 'GA1234567890ABCDEF',
    lastChangedAt: NOW - 1000,
    history: [],
    ...overrides,
  }
}

describe('ParameterRegistryPanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the section heading', () => {
    render(<ParameterRegistryPanel records={[]} now={NOW} />)
    expect(screen.getByRole('heading', { name: 'Parameter registry' })).toBeDefined()
  })

  it('shows a message when there are no records', () => {
    render(<ParameterRegistryPanel records={[]} now={NOW} />)
    expect(screen.getByText(/No parameters have been registered yet/)).toBeDefined()
  })

  it('renders a record with its label, key, and current value', () => {
    render(<ParameterRegistryPanel records={[makeRecord()]} now={NOW} />)
    expect(screen.getByText('Minimum sources')).toBeDefined()
    expect(screen.getByText('aggregator.minSources')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
  })

  it('groups records by category with a category heading', () => {
    const records = [
      makeRecord({ key: 'agg.min', category: 'aggregation', label: 'Min sources' }),
      makeRecord({ key: 'stake.period', category: 'staking', label: 'Lock period' }),
    ]
    render(<ParameterRegistryPanel records={records} now={NOW} />)
    expect(screen.getByText('aggregation')).toBeDefined()
    expect(screen.getByText('staking')).toBeDefined()
  })

  it('shows recently-updated badge for changes within 24 h', () => {
    const record = makeRecord({ lastChangedAt: NOW - 1000 }) // 1 second ago
    render(<ParameterRegistryPanel records={[record]} now={NOW} />)
    expect(screen.getByText('Updated recently')).toBeDefined()
  })

  it('does not show recently-updated badge for older changes', () => {
    const record = makeRecord({ lastChangedAt: NOW - 2 * 24 * 60 * 60 * 1000 }) // 2 days ago
    render(<ParameterRegistryPanel records={[record]} now={NOW} />)
    expect(screen.queryByText('Updated recently')).toBeNull()
  })

  it('shows "Never changed" when lastChangedAt is null', () => {
    render(<ParameterRegistryPanel records={[makeRecord({ lastChangedAt: null })]} now={NOW} />)
    expect(screen.getByText('Never changed')).toBeDefined()
  })

  it('shows a history toggle when the record has history entries', async () => {
    const user = userEvent.setup()
    const record = makeRecord({
      history: [
        {
          version: 1,
          changedAt: NOW - 2000,
          changedBy: 'GX_OPERATOR_A',
          previousValue: '2',
          newValue: '3',
          reason: 'Increased resilience.',
        },
      ],
    })
    render(<ParameterRegistryPanel records={[record]} now={NOW} />)
    const toggle = screen.getByRole('button', { name: /Show change history/ })
    expect(toggle).toBeDefined()
    await user.click(toggle)
    // Reason appears in both the "Last reason" summary and the expanded history
    const reasonTexts = screen.getAllByText('Increased resilience.')
    expect(reasonTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('filters records by search query', async () => {
    const user = userEvent.setup()
    const records = [
      makeRecord({ key: 'agg.min', label: 'Minimum sources', category: 'aggregation' }),
      makeRecord({ key: 'stake.lock', label: 'Lock period', category: 'staking' }),
    ]
    render(<ParameterRegistryPanel records={records} now={NOW} />)
    const input = screen.getByRole('searchbox')
    await user.type(input, 'lock')
    expect(screen.queryByText('Minimum sources')).toBeNull()
    expect(screen.getByText('Lock period')).toBeDefined()
  })

  it('shows "no match" message when search yields nothing', async () => {
    const user = userEvent.setup()
    render(<ParameterRegistryPanel records={[makeRecord()]} now={NOW} />)
    await user.type(screen.getByRole('searchbox'), 'zzz_nomatch')
    expect(screen.getByText(/No parameters match your search/)).toBeDefined()
  })

  it('allows subscribing to and unsubscribing from parameter updates (#852)', async () => {
    const user = userEvent.setup()
    const record = makeRecord({ key: 'aggregator.minSources', label: 'Minimum sources' })
    render(<ParameterRegistryPanel records={[record]} now={NOW} />)

    const watchButton = screen.getByRole('button', { name: 'Watch Minimum sources' })
    expect(watchButton.getAttribute('aria-pressed')).toBe('false')

    await user.click(watchButton)
    expect(screen.getByRole('button', { name: 'Unwatch Minimum sources' })).toBeDefined()
    expect(screen.getAllByText('Watching').length).toBeGreaterThanOrEqual(1)

    // Unwatch
    await user.click(screen.getByRole('button', { name: 'Unwatch Minimum sources' }))
    expect(screen.getByRole('button', { name: 'Watch Minimum sources' })).toBeDefined()
    expect(screen.queryByText('Watching')).toBeNull()
  })

  it('filters by watched parameters tab and handles empty watched state (#852)', async () => {
    const user = userEvent.setup()
    const records = [
      makeRecord({ key: 'param.a', label: 'Param Alpha', category: 'cat1' }),
      makeRecord({ key: 'param.b', label: 'Param Beta', category: 'cat2' }),
    ]
    render(<ParameterRegistryPanel records={records} now={NOW} />)

    const watchedTab = screen.getByRole('tab', { name: /Watched/ })
    await user.click(watchedTab)

    expect(
      screen.getByText(/You are not watching any parameters yet. Click the "Watch" button on any parameter/),
    ).toBeDefined()
    expect(screen.queryByText('Param Alpha')).toBeNull()

    // Switch back to all and watch Param Alpha
    await user.click(screen.getByRole('tab', { name: /All parameters/ }))
    await user.click(screen.getByRole('button', { name: 'Watch Param Alpha' }))

    // Switch to watched tab again
    await user.click(watchedTab)
    expect(screen.getByText('Param Alpha')).toBeDefined()
    expect(screen.queryByText('Param Beta')).toBeNull()
  })

  it('renders change alert banner when a watched parameter updates and allows dismissing (#852)', async () => {
    const user = userEvent.setup()
    const initialRecord = makeRecord({
      key: 'aggregator.minSources',
      label: 'Minimum sources',
      currentValue: '3',
      lastChangedAt: NOW - 10_000,
    })

    const { rerender } = render(<ParameterRegistryPanel records={[initialRecord]} now={NOW} />)

    // Subscribe to Minimum sources
    await user.click(screen.getByRole('button', { name: 'Watch Minimum sources' }))

    // Simulate incoming data refresh with an updated parameter value
    const updatedRecord = makeRecord({
      key: 'aggregator.minSources',
      label: 'Minimum sources',
      currentValue: '5',
      lastChangedAt: NOW,
    })

    rerender(<ParameterRegistryPanel records={[updatedRecord]} now={NOW} />)

    // Notification banner should be visible
    const banner = screen.getByRole('status', { name: 'Watched parameter updates' })
    expect(banner).toBeDefined()
    expect(within(banner).getByText(/1 watched parameter has changed/)).toBeDefined()
    expect(within(banner).getByText('5')).toBeDefined()

    // Dismiss the banner
    const dismissAllBtn = screen.getByRole('button', { name: 'Dismiss all' })
    await user.click(dismissAllBtn)
    expect(screen.queryByRole('status', { name: 'Watched parameter updates' })).toBeNull()
  })
})

