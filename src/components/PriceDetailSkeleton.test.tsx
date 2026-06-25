import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PriceDetailSkeleton } from './PriceDetailSkeleton'
import { checkAccessibility } from '../test/accessibility'

describe('PriceDetailSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<PriceDetailSkeleton />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
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
