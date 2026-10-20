import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RoadmapCard } from './RoadmapCard'
import type { RoadmapItem } from '../types/roadmap'

afterEach(cleanup)

const mockItem: RoadmapItem = {
  id: 'test-roadmap-1',
  title: 'Decentralized Oracle Feed Auditing',
  category: 'security',
  status: 'testnet',
  targetMilestone: 'Protocol 22',
  description: 'Automated cryptographic proofs verifying aggregate source consistency.',
  steward: 'Security WG',
  lastUpdated: 1773000000000,
  changeHistory: [
    {
      id: 'ch-1',
      fromStatus: 'initial',
      toStatus: 'planned',
      changedAt: 1769000000000,
      reason: 'Specification accepted by governance vote',
      changedBy: 'Governance Council',
      evidenceUrl: 'https://example.com/proposal/1',
    },
    {
      id: 'ch-2',
      fromStatus: 'planned',
      toStatus: 'testnet',
      changedAt: 1773000000000,
      reason: 'Deployed and verified on Soroban testnet',
      changedBy: 'Security WG',
      evidenceUrl: 'https://example.com/explorer/tx/123',
    },
  ],
}

describe('RoadmapCard', () => {
  it('renders card title, category, milestone, status badge, and steward', () => {
    render(<RoadmapCard item={mockItem} />)

    expect(screen.getByRole('heading', { name: mockItem.title })).toBeInTheDocument()
    expect(screen.getByText('Security & ZK')).toBeInTheDocument()
    expect(screen.getByText('Protocol 22')).toBeInTheDocument()
    expect(screen.getByText('Testnet Live')).toBeInTheDocument()
    expect(screen.getByText('Security WG')).toBeInTheDocument()
    expect(screen.getByText(mockItem.description)).toBeInTheDocument()
  })

  it('collapses change history by default and sets proper ARIA attributes', () => {
    render(<RoadmapCard item={mockItem} />)

    const toggleBtn = screen.getByRole('button', {
      name: `Toggle public change history for ${mockItem.title}`,
    })
    expect(toggleBtn).toBeInTheDocument()
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false')

    // Change reasons should not be rendered before expansion
    expect(screen.queryByText('Specification accepted by governance vote')).not.toBeInTheDocument()
  })

  it('expands change history timeline upon click and displays full audit trail and evidence links', () => {
    render(<RoadmapCard item={mockItem} />)

    const toggleBtn = screen.getByRole('button', {
      name: `Toggle public change history for ${mockItem.title}`,
    })

    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByText('Specification accepted by governance vote')).toBeInTheDocument()
    expect(screen.getByText('Deployed and verified on Soroban testnet')).toBeInTheDocument()
    expect(screen.getByText('Changed by: Governance Council')).toBeInTheDocument()

    const evidenceLinks = screen.getAllByRole('link', { name: /view evidence/i })
    expect(evidenceLinks.length).toBe(2)
    expect(evidenceLinks[0]).toHaveAttribute('href', 'https://example.com/proposal/1')
    expect(evidenceLinks[0]).toHaveAttribute('target', '_blank')
    expect(evidenceLinks[0]).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('supports defaultExpanded prop for direct deep-linking or expanded mode', () => {
    render(<RoadmapCard item={mockItem} defaultExpanded={true} />)

    expect(screen.getByText('Specification accepted by governance vote')).toBeInTheDocument()
  })

  it('handles item with empty change history cleanly', () => {
    const emptyHistoryItem: RoadmapItem = {
      ...mockItem,
      id: 'empty-ch',
      changeHistory: [],
    }

    render(<RoadmapCard item={emptyHistoryItem} defaultExpanded={true} />)

    expect(screen.getByText('No recorded status changes.')).toBeInTheDocument()
  })
})
