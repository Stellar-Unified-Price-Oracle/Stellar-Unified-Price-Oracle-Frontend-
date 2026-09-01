import { describe, it, expect, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useFeatureFlag } from './useFeatureFlag'

type WindowWithFeatureFlags = Window & {
  __featureFlags?: {
    list: () => Record<string, boolean>
    override: (key: string, value: boolean) => void
    clear: (key?: string) => void
  }
}

function devFlags() {
  const flags = (window as WindowWithFeatureFlags).__featureFlags
  if (!flags) throw new Error('window.__featureFlags was not installed (expected in DEV)')
  return flags
}

afterEach(() => {
  devFlags().clear()
})

describe('useFeatureFlag', () => {
  it('returns the flag default on first render', () => {
    const { result } = renderHook(() => useFeatureFlag('memoryWarningReporting'))
    expect(result.current).toBe(true)
  })

  it('re-renders when a dev-console override changes the flag', () => {
    const { result } = renderHook(() => useFeatureFlag('memoryWarningReporting'))
    expect(result.current).toBe(true)

    act(() => {
      devFlags().override('memoryWarningReporting', false)
    })

    expect(result.current).toBe(false)
  })
})
