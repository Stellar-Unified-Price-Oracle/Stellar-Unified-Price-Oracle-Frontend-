import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { Roadmap } from './Roadmap'
import * as restApi from '../api/rest'
import { clearSwrCache } from '../hooks/useSwr'
import type { RoadmapItem } from '../types/roadmap'

afterEach(cleanup)

const mockItems: RoadmapItem[] = [
  {
    id: 'item-1',
    title: 'Soroban On-Chain TWAP Oracle Contract',
    category: 'protocol',
    status: 'testnet',
    targetMilestone: 'Protocol 22',
    description: 'Deploy TWAP module directly on Soroban smart contracts.',
    steward: 'Core Oracle Committee',
    lastUpdated: 1773000000000,
    changeHistory: [
      {
        id: 'twap-1',
        fromStatus: 'initial',
        toStatus: 'testnet',
        changedAt: 1773000000000,
        reason: 'Deployed to testnet',
        changedBy: 'Steward team',
        evidenceUrl: 'https://example.com/tx/1',
      },
    ],
  },
  {
    id: 'item-2',
    title: 'Sub-Second WebSocket Feed Compression',
    category: 'infrastructure',
    status: 'completed',
    targetMilestone: 'Q3 2026',
    description: 'Brotli and binary delta streaming over WebSockets.',
    steward: 'Infrastructure SIG',
    lastUpdated: 1772500000000,
    changeHistory: [],
  },
  {
    id: 'item-3',
    title: 'Zero-Knowledge Oracle Aggregation Proofs',
    category: 'security',
    status: 'planned',
    targetMilestone: 'Q2 2027',
    description: 'Cryptographic zero-knowledge proofs for oracle validation.',
    steward: 'Cryptography Research Group',
    lastUpdated: 1772200000000,
    changeHistory: [],
  },
]

describe('Roadmap Page', () => {
  beforeEach(() => {
    clearSwrCache()
    vi.restoreAllMocks()
    vi.spyOn(restApi, 'fetchRoadmapItems').mockResolvedValue(mockItems)
  })

  it('renders page header, status ribbon metrics, and items', async () => {
    render(<Roadmap />)

    expect(
      screen.getByRole('heading', { name: /protocol roadmap & public change history/i }),
    ).toBeInTheDocument()

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('Soroban On-Chain TWAP Oracle Contract')).toBeInTheDocument()
    })

    expect(screen.getByText('Sub-Second WebSocket Feed Compression')).toBeInTheDocument()
    expect(screen.getByText('Zero-Knowledge Oracle Aggregation Proofs')).toBeInTheDocument()

    // Status summary metrics
    expect(screen.getAllByText('Testnet Live').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Planned').length).toBeGreaterThan(0)
  })

  it('filters items by search text query', async () => {
    render(<Roadmap />)

    await waitFor(() => {
      expect(screen.getByText('Soroban On-Chain TWAP Oracle Contract')).toBeInTheDocument()
    })

    const searchInput = screen.getByLabelText(/search roadmap items/i)
    fireEvent.change(searchInput, { target: { value: 'WebSocket' } })

    expect(screen.getByText('Sub-Second WebSocket Feed Compression')).toBeInTheDocument()
    expect(screen.queryByText('Soroban On-Chain TWAP Oracle Contract')).not.toBeInTheDocument()
    expect(screen.queryByText('Zero-Knowledge Oracle Aggregation Proofs')).not.toBeInTheDocument()

    // Live status announcement
    expect(screen.getByRole('status')).toHaveTextContent(/showing 1 of 3 roadmap items/i)
  })

  it('filters items by clicking status summary metric button', async () => {
    render(<Roadmap />)

    await waitFor(() => {
      expect(screen.getByText('Soroban On-Chain TWAP Oracle Contract')).toBeInTheDocument()
    })

    const completedMetricBtn = screen.getByRole('button', { name: 'Filter by status: Completed' })
    fireEvent.click(completedMetricBtn)

    expect(screen.getByText('Sub-Second WebSocket Feed Compression')).toBeInTheDocument()
    expect(screen.queryByText('Soroban On-Chain TWAP Oracle Contract')).not.toBeInTheDocument()
    expect(screen.queryByText('Zero-Knowledge Oracle Aggregation Proofs')).not.toBeInTheDocument()

    // Clicking again deselects filter
    fireEvent.click(completedMetricBtn)
    expect(screen.getByText('Soroban On-Chain TWAP Oracle Contract')).toBeInTheDocument()
  })

  it('filters items by category dropdown', async () => {
    render(<Roadmap />)

    await waitFor(() => {
      expect(screen.getByText('Soroban On-Chain TWAP Oracle Contract')).toBeInTheDocument()
    })

    const categorySelect = screen.getByLabelText(/category:/i)
    fireEvent.change(categorySelect, { target: { value: 'security' } })

    expect(screen.getByText('Zero-Knowledge Oracle Aggregation Proofs')).toBeInTheDocument()
    expect(screen.queryByText('Soroban On-Chain TWAP Oracle Contract')).not.toBeInTheDocument()
    expect(screen.queryByText('Sub-Second WebSocket Feed Compression')).not.toBeInTheDocument()
  })

  it('clears active filters with Reset Filters button', async () => {
    render(<Roadmap />)

    await waitFor(() => {
      expect(screen.getByText('Soroban On-Chain TWAP Oracle Contract')).toBeInTheDocument()
    })

    const searchInput = screen.getByLabelText(/search roadmap items/i)
    fireEvent.change(searchInput, { target: { value: 'Nonexistent feature' } })

    expect(screen.getByText(/no roadmap items matched your search/i)).toBeInTheDocument()

    const resetBtn = screen.getByRole('button', { name: /clear all filters/i })
    fireEvent.click(resetBtn)

    expect(screen.getByText('Soroban On-Chain TWAP Oracle Contract')).toBeInTheDocument()
    expect(screen.getByText('Sub-Second WebSocket Feed Compression')).toBeInTheDocument()
  })

  it('shows error banner with retry option if API fails', async () => {
    vi.spyOn(restApi, 'fetchRoadmapItems').mockRejectedValue(new Error('Network failure'))

    render(<Roadmap />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    expect(screen.getByText(/unable to load roadmap items/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument()
  })
})
