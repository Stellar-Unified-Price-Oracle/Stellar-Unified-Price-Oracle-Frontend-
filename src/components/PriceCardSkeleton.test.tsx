import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PriceCardSkeleton } from './PriceCardSkeleton'
import { checkAccessibility } from '../test/accessibility'

describe('PriceCardSkeleton', () => {
  it('should have no accessibility violations', async () => {
    await checkAccessibility(<PriceCardSkeleton />)
  })

  it('renders without crashing', () => {
    const { container } = render(<PriceCardSkeleton />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('is hidden from accessibility tree', () => {
    const { container } = render(<PriceCardSkeleton />)
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})

describe('snapshots', () => {
  it('default', () => {
    const { container } = render(<PriceCardSkeleton />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
