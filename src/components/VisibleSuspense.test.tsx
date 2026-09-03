import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { VisibleSuspense } from './VisibleSuspense'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('VisibleSuspense', () => {
  it('does not mount children until the boundary intersects', () => {
    let notifyIntersection: ((entries: IntersectionObserverEntry[]) => void) | undefined
    const disconnect = vi.fn()

    class IntersectionObserverMock {
      constructor(callback: (entries: IntersectionObserverEntry[]) => void) {
        notifyIntersection = callback
      }

      observe = vi.fn()
      disconnect = disconnect
    }

    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)

    render(
      <VisibleSuspense fallback={<div>Chart placeholder</div>}>
        <div>Heavy chart</div>
      </VisibleSuspense>,
    )

    expect(screen.getByText('Chart placeholder')).toBeInTheDocument()
    expect(screen.queryByText('Heavy chart')).not.toBeInTheDocument()

    act(() => {
      notifyIntersection?.([{ isIntersecting: true } as IntersectionObserverEntry])
    })

    expect(screen.getByText('Heavy chart')).toBeInTheDocument()
    expect(disconnect).toHaveBeenCalled()
  })
})
