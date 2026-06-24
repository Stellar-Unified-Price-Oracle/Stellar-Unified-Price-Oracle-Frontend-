import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SourceHealthBadge } from './SourceHealthBadge'
import { checkAccessibility } from '../test/accessibility'

afterEach(cleanup)

describe('SourceHealthBadge', () => {
  it('should have no accessibility violations', async () => {
    await checkAccessibility(<SourceHealthBadge sources={['chainlink', 'redstone']} />)
  })

  it('renders known sources with labels', () => {
    render(<SourceHealthBadge sources={['chainlink', 'redstone']} />)
    expect(screen.getAllByText('Chainlink').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Redstone').length).toBeGreaterThanOrEqual(1)
  })

  it('renders "No sources" when empty', () => {
    render(<SourceHealthBadge sources={[]} />)
    expect(screen.getByText('No sources')).toBeInTheDocument()
  })

  it('handles unknown sources gracefully', () => {
    render(<SourceHealthBadge sources={['unknown_source']} />)
    expect(screen.queryByText('unknown_source')).not.toBeInTheDocument()
  })

  it('renders multiple sources', () => {
    render(<SourceHealthBadge sources={['chainlink', 'redstone', 'band', 'reflector']} />)
    expect(screen.getAllByText('Chainlink')).toHaveLength(1)
    expect(screen.getAllByText('Redstone')).toHaveLength(1)
    expect(screen.getAllByText('Band')).toHaveLength(1)
    expect(screen.getAllByText('Reflector')).toHaveLength(1)
  })
})

describe('snapshots', () => {
  it('with sources', () => {
    const { container } = render(<SourceHealthBadge sources={['chainlink', 'redstone', 'band', 'reflector']} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('empty', () => {
    const { container } = render(<SourceHealthBadge sources={[]} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
