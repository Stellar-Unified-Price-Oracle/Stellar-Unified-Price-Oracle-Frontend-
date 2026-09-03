import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRateLimitStore } from '../stores/rateLimitStore'
import { getLimiter } from '../utils/rateLimit'
import type { PriceData } from '../types'
import { useExport } from './useExport'

const mockPrices: PriceData[] = [
  { assetPair: 'BTC/USD', price: 50000, timestamp: 0, confidence: 0.99, sources: ['chainlink'] },
  { assetPair: 'ETH/USD', price: 3000, timestamp: 0, confidence: 0.95, sources: ['redstone', 'band'] },
]

function mockBlob(
  onCreate: (parts: BlobPart[], options: BlobPropertyBag) => void,
): void {
  class BlobMock {
    readonly type: string

    constructor(parts: BlobPart[] = [], options: BlobPropertyBag = {}) {
      this.type = options.type ?? ''
      onCreate(parts, options)
    }
  }

  vi.stubGlobal('Blob', BlobMock)
}

describe('useExport', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>
  let originalCreateElement: typeof document.createElement

  beforeEach(() => {
    localStorage.clear()
    getLimiter('export').reset()
    useRateLimitStore.getState().refresh()
    createObjectURLSpy = vi.fn(() => 'blob:test')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()
    URL.createObjectURL = createObjectURLSpy as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURLSpy as typeof URL.revokeObjectURL

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
    vi.unstubAllGlobals()
  })

  describe('exportCSV', () => {
    it('returns an exportCSV function', () => {
      const { result } = renderHook(() => useExport())
      expect(typeof result.current.exportCSV).toBe('function')
    })

    it('triggers a file download when exportCSV is called', async () => {
      const { result } = renderHook(() => useExport())
      await result.current.exportCSV(mockPrices)
      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test')
    })

    it('exports correct CSV content with price data fields', async () => {
      let capturedContent = ''
      mockBlob((parts) => {
        capturedContent = String(parts[0])
      })

      const { result } = renderHook(() => useExport())
      await result.current.exportCSV(mockPrices)

      expect(capturedContent).toContain('assetPair')
      expect(capturedContent).toContain('BTC/USD')
      expect(capturedContent).toContain('ETH/USD')
    })

    it('exports empty CSV with only headers when given no items', async () => {
      let capturedContent = ''
      mockBlob((parts) => {
        capturedContent = String(parts[0])
      })

      const { result } = renderHook(() => useExport())
      await result.current.exportCSV([])

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

  describe('exportJSON', () => {
    it('triggers a file download when exportJSON is called', async () => {
      const { result } = renderHook(() => useExport())
      await result.current.exportJSON(mockPrices)
      expect(createObjectURLSpy).toHaveBeenCalled()
      expect(clickSpy).toHaveBeenCalled()
    })

    it('exports valid JSON with all price data fields', async () => {
      let capturedContent = ''
      mockBlob((parts) => {
        capturedContent = String(parts[0])
      })

      const { result } = renderHook(() => useExport())
      await result.current.exportJSON(mockPrices)

      const parsed = JSON.parse(capturedContent)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].assetPair).toBe('BTC/USD')
      expect(parsed[0].price).toBe(50000)
      expect(parsed[1].assetPair).toBe('ETH/USD')
    })

    it('exports empty array when given no items', async () => {
      let capturedContent = ''
      mockBlob((parts) => {
        capturedContent = String(parts[0])
      })

      const { result } = renderHook(() => useExport())
      await result.current.exportJSON([])

      const parsed = JSON.parse(capturedContent)
      expect(parsed).toEqual([])
    })

    it('formats JSON with indentation', async () => {
      let capturedContent = ''
      mockBlob((parts) => {
        capturedContent = String(parts[0])
      })

      const { result } = renderHook(() => useExport())
      await result.current.exportJSON(mockPrices)

      expect(capturedContent).toContain('\n  ')
    })

    it('returns a stable exportJSON reference across renders', () => {
      const { result, rerender } = renderHook(() => useExport())
      const first = result.current.exportJSON
      rerender()
      expect(result.current.exportJSON).toBe(first)
    })
  })

  describe('exportData', () => {
    it('exports CSV when format is csv', async () => {
      let capturedType = ''
      mockBlob((_parts, options) => {
        capturedType = options.type ?? ''
      })

      const { result } = renderHook(() => useExport())
      await result.current.exportData('csv', mockPrices)

      expect(capturedType).toBe('text/csv')
    })

    it('exports JSON when format is json', async () => {
      let capturedType = ''
      mockBlob((_parts, options) => {
        capturedType = options.type ?? ''
      })

      const { result } = renderHook(() => useExport())
      await result.current.exportData('json', mockPrices)

      expect(capturedType).toBe('application/json')
    })

    it('returns a stable exportData reference across renders', () => {
      const { result, rerender } = renderHook(() => useExport())
      const first = result.current.exportData
      rerender()
      expect(result.current.exportData).toBe(first)
    })
  })
})
