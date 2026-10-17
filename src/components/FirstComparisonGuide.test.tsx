import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComparisonGuideProgress } from '../utils/firstComparisonGuide'
import { FirstComparisonGuide } from './FirstComparisonGuide'

const fresh: ComparisonGuideProgress = { viewedPair: false, comparedPairs: false, dismissed: false }

describe('FirstComparisonGuide', () => {
  it('lists both steps as to do for a new user', () => {
    render(<FirstComparisonGuide progress={fresh} onDismiss={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Make your first price comparison' })).toBeInTheDocument()
    expect(screen.getAllByText('(to do)')).toHaveLength(2)
  })

  it('marks completed steps in text, not only in colour', () => {
    render(<FirstComparisonGuide progress={{ ...fresh, viewedPair: true }} onDismiss={vi.fn()} />)
    expect(screen.getByText('(completed)')).toBeInTheDocument()
    expect(screen.getByText('(to do)')).toBeInTheDocument()
  })

  it('calls onDismiss from the native dismiss button', () => {
    const onDismiss = vi.fn()
    render(<FirstComparisonGuide progress={fresh} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss guide' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders nothing once dismissed', () => {
    const { container } = render(<FirstComparisonGuide progress={{ ...fresh, dismissed: true }} onDismiss={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing once both checkpoints are complete', () => {
    const { container } = render(
      <FirstComparisonGuide
        progress={{ viewedPair: true, comparedPairs: true, dismissed: false }}
        onDismiss={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
