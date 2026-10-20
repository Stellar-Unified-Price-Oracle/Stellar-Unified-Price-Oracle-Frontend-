import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProposedParameterDiff } from './ProposedParameterDiff'
import type { ProposedParameterChange } from '../types/governance'

const sampleChanges: ProposedParameterChange[] = [
  {
    paramKey: 'aggregator.minSources',
    paramName: 'Minimum Sources',
    category: 'aggregation',
    currentValue: '3',
    proposedValue: '4',
    diffType: 'modify',
    rationale: 'Improve fault tolerance across validators.',
    unit: 'sources',
  },
  {
    paramKey: 'aggregator.heartbeatSec',
    paramName: 'Heartbeat Interval',
    category: 'aggregation',
    currentValue: '60',
    proposedValue: '30',
    diffType: 'modify',
    unit: 'seconds',
  },
  {
    paramKey: 'threshold.liquidityBuffer',
    paramName: 'Liquidity Buffer',
    category: 'thresholds',
    currentValue: null,
    proposedValue: '15%',
    diffType: 'add',
    rationale: 'Introduce safety margin during high volatility.',
  },
  {
    paramKey: 'legacy.deprecatedTimeout',
    paramName: 'Deprecated Timeout',
    category: 'thresholds',
    currentValue: '500',
    proposedValue: null,
    diffType: 'remove',
    rationale: 'Phasing out legacy timeouts.',
  },
]

describe('ProposedParameterDiff', () => {
  it('renders empty message when no changes are provided', () => {
    render(<ProposedParameterDiff changes={[]} />)
    expect(screen.getByText(/No parameter modifications proposed/i)).toBeInTheDocument()
  })

  it('renders all parameter changes with names, keys, and values', () => {
    render(<ProposedParameterDiff changes={sampleChanges} proposalId="PROP-101" />)

    expect(screen.getByText('Minimum Sources')).toBeInTheDocument()
    expect(screen.getByText('aggregator.minSources')).toBeInTheDocument()
    expect(screen.getByText('Heartbeat Interval')).toBeInTheDocument()
    expect(screen.getByText('Liquidity Buffer')).toBeInTheDocument()
    expect(screen.getByText('Deprecated Timeout')).toBeInTheDocument()

    // 4 changes summary badge
    expect(screen.getByText('4 changes')).toBeInTheDocument()
  })

  it('renders side-by-side columns by default with current and proposed values', () => {
    render(<ProposedParameterDiff changes={sampleChanges} proposalId="PROP-101" />)

    // Current and Proposed column headers
    const currentHeaders = screen.getAllByText('Current Registry Value')
    const proposedHeaders = screen.getAllByText('Proposed Governance Value')
    expect(currentHeaders.length).toBe(sampleChanges.length)
    expect(proposedHeaders.length).toBe(sampleChanges.length)

    // Values formatted with units
    expect(screen.getByText('3 sources')).toBeInTheDocument()
    expect(screen.getByText('4 sources')).toBeInTheDocument()
  })

  it('calculates and displays numerical delta badges', () => {
    render(<ProposedParameterDiff changes={sampleChanges} proposalId="PROP-101" />)

    // +1 (+33.3%) for minSources (3 -> 4)
    expect(screen.getByText(/\+1 \(\+33\.3%\)/i)).toBeInTheDocument()
    // -30 (-50.0%) for heartbeat (60 -> 30)
    expect(screen.getByText(/-30 \(-50\.0%\)/i)).toBeInTheDocument()
  })

  it('handles newly added and deprecated parameters cleanly without crashing or fabricating', () => {
    render(<ProposedParameterDiff changes={sampleChanges} proposalId="PROP-101" />)

    // New parameter: None (new parameter)
    expect(screen.getByText(/None \(new parameter\)/i)).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()

    // Removed parameter: Deprecated (removed)
    expect(screen.getByText(/Deprecated \(removed\)/i)).toBeInTheDocument()
  })

  it('toggles between Side-by-side and Unified view modes', () => {
    render(<ProposedParameterDiff changes={sampleChanges} proposalId="PROP-101" />)

    const sideBySideBtn = screen.getByRole('button', { name: /Side-by-side/i })
    const unifiedBtn = screen.getByRole('button', { name: /Unified/i })

    expect(sideBySideBtn).toHaveAttribute('aria-pressed', 'true')
    expect(unifiedBtn).toHaveAttribute('aria-pressed', 'false')

    // Click Unified
    fireEvent.click(unifiedBtn)
    expect(unifiedBtn).toHaveAttribute('aria-pressed', 'true')
    expect(sideBySideBtn).toHaveAttribute('aria-pressed', 'false')

    // In unified view, arrow indicators exist
    const arrows = screen.getAllByText('→')
    expect(arrows.length).toBeGreaterThan(0)

    // Click back to Side-by-side
    fireEvent.click(sideBySideBtn)
    expect(sideBySideBtn).toHaveAttribute('aria-pressed', 'true')
  })

  it('filters by category when multiple categories exist', () => {
    render(<ProposedParameterDiff changes={sampleChanges} proposalId="PROP-101" />)

    const select = screen.getByLabelText(/Filter by category/i)
    expect(select).toBeInTheDocument()

    // Filter to "thresholds"
    fireEvent.change(select, { target: { value: 'thresholds' } })

    expect(screen.queryByText('Minimum Sources')).not.toBeInTheDocument()
    expect(screen.getByText('Liquidity Buffer')).toBeInTheDocument()
    expect(screen.getByText('Deprecated Timeout')).toBeInTheDocument()
  })
})
