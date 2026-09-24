import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { checkAccessibility } from '../../test/accessibility'
import { DashboardSkeleton } from './DashboardSkeleton'

describe('DashboardSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<DashboardSkeleton />)
    expect(container.querySelector('.skeleton-shimmer')).toBeInTheDocument()
  })

  it('has aria-busy and aria-label during loading', () => {
    const { container } = render(<DashboardSkeleton />)
    const el = container.querySelector('[aria-label="Loading dashboard"]')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('aria-busy', 'true')
  })

  it('should have no accessibility violations', async () => {
    await checkAccessibility(<DashboardSkeleton />)
  })
})
