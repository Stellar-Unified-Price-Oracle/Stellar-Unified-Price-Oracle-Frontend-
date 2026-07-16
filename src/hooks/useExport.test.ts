import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useExport } from './useExport'

const mockPrices = [
  { assetPair: 'BTC/USD', price: 50000, timestamp: 0, confidence: 0.99, sources: ['chainlink'] },
  { assetPair: 'ETH/USD', price: 3000, timestamp: 0, confidence: 0.95, sources: ['redstone', 'band'] },
]

describe('useExport', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>
  let originalCreateElement: typeof document.createElement

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => 'blob:test')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()
    URL.createObjectURL = createObjectURLSpy
    URL.revokeObjectURL = revokeObjectURLSpy

    originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement
      }
      return originalCreateElement(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an exportCSV function', () => {
    const { result } = renderHook(() => useExport())
    expect(typeof result.current.exportCSV).toBe('function')
  })

  it('triggers a file download when exportCSV is called', () => {
    const { result } = renderHook(() => useExport())
    result.current.exportCSV(mockPrices)
    expect(createObjectURLSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test')
  })

  it('exports correct CSV content with price data fields', () => {
    let capturedContent = ''
    vi.spyOn(global, 'Blob').mockImplementation((parts) => {
      capturedContent = (parts as string[])[0]
      return { type: 'text/csv' } as Blob
    })

    const { result } = renderHook(() => useExport())
    result.current.exportCSV(mockPrices)

    expect(capturedContent).toContain('assetPair')
    expect(capturedContent).toContain('BTC/USD')
    expect(capturedContent).toContain('ETH/USD')
  })

  it('exports empty CSV with only headers when given no items', () => {
    let capturedContent = ''
    vi.spyOn(global, 'Blob').mockImplementation((parts) => {
      capturedContent = (parts as string[])[0]
      return { type: 'text/csv' } as Blob
    })

    const { result } = renderHook(() => useExport())
    result.current.exportCSV([])

    expect(capturedContent).toContain('assetPair')
    const lines = capturedContent.split('\n')
    expect(lines).toHaveLength(1)
  })

  it('returns a stable exportCSV reference across renders', () => {
    const { result, rerender } = renderHook(() => useExport())
    const first = result.current.exportCSV
    rerender()
    expect(result.current.exportCSV).toBe(first)
  })
})
