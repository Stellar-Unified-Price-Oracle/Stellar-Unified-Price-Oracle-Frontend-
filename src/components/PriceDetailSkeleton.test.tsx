import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { checkAccessibility } from '../test/accessibility'
import { PriceDetailSkeleton } from './PriceDetailSkeleton'

describe('PriceDetailSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<PriceDetailSkeleton />)
    expect(container.querySelector('.skeleton-shimmer')).toBeInTheDocument()
  })

  it('has aria-busy and aria-label during loading', () => {
    const { container } = render(<PriceDetailSkeleton />)
    const el = container.querySelector('[aria-label="Loading price detail"]')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('aria-busy', 'true')
  })

  it('should have no accessibility violations', async () => {
    await checkAccessibility(<PriceDetailSkeleton />)
  })
})

describe('PriceDetailSkeleton snapshots', () => {
  it('default', () => {
    const { container } = render(<PriceDetailSkeleton />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
