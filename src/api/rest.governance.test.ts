/**
 * Tests for the fail-closed governance fetch.
 *
 * The behaviour under test is a trust guarantee, not just a code path: a
 * proposal payload that fails validation must be withheld rather than rendered,
 * and one bad entry must not blank the whole list.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rateLimitManager } from './rateLimit'

vi.mock('../config', () => ({
  config: {
    apiUrl: '',
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
      jitter: true,
    },
    circuitBreaker: {
      failureThreshold: 5,
      windowMs: 30_000,
      cooldownMs: 30_000,
    },
    priceBatch: {
      debounceMs: 50,
      maxBatchSize: 20,
    },
  },
}))

vi.mock('../hooks/useIndexedDB', () => ({
  idbCache: { get: vi.fn().mockResolvedValue(null), set: vi.fn() },
}))

vi.mock('../context/ToastContext', () => ({
  showApiErrorToast: vi.fn(),
}))

const restModule = await import('./rest')
const { fetchGovernanceProposals, resetApiErrorToastState } = restModule
const { circuitBreaker } = await import('./circuitBreaker')

const mockFetch = vi.fn()
let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
  vi.useFakeTimers()
  resetApiErrorToastState()
  circuitBreaker.reset()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.runAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  rateLimitManager.clearRateLimit()
  resetApiErrorToastState()
  warnSpy.mockRestore()
})

function okResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data), text: () => Promise.resolve('') }
}

function validProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'GOV-1',
    title: 'Add Reflector as a primary source',
    summary: 'Promote Reflector from fallback to weighted contributor.',
    status: 'active',
    createdAt: 1_700_000_000_000,
    closesAt: 1_700_600_000_000,
    tally: { for: 10, against: 3, abstain: 1 },
    quorum: 8,
    totalVotingPower: 40,
    category: 'oracle-sources',
    relatedSources: ['reflector'],
    ...overrides,
  }
}

describe('fetchGovernanceProposals', () => {
  it('requests the governance endpoint and returns validated proposals', async () => {
    mockFetch.mockResolvedValue(okResponse([validProposal()]))

    const result = await fetchGovernanceProposals()

    expect(mockFetch.mock.calls[0][0]).toBe('/api/governance/proposals')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'GOV-1', status: 'active' })
    expect(result[0].tally).toEqual({ for: 10, against: 3, abstain: 1 })
  })

  it('withholds a malformed entry but keeps the valid ones', async () => {
    mockFetch.mockResolvedValue(
      okResponse([
        validProposal({ id: 'GOV-1' }),
        // Negative vote count — proves a tampered tally never reaches the UI.
        validProposal({ id: 'GOV-2', tally: { for: -1, against: 0, abstain: 0 } }),
        validProposal({ id: 'GOV-3' }),
      ]),
    )

    const result = await fetchGovernanceProposals()

    expect(result.map((p) => p.id)).toEqual(['GOV-1', 'GOV-3'])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('withholds a proposal with an unrecognised status', async () => {
    mockFetch.mockResolvedValue(okResponse([validProposal({ status: 'rigged' })]))

    const result = await fetchGovernanceProposals()

    expect(result).toEqual([])
  })

  it('requires nullable fields to be present rather than omitted', async () => {
    // An omitted quorum is indistinguishable from "quorum is zero" once typed,
    // so the schema rejects the omission instead of silently defaulting it.
    const { quorum: _quorum, ...withoutQuorum } = validProposal()
    mockFetch.mockResolvedValue(okResponse([withoutQuorum]))

    const result = await fetchGovernanceProposals()

    expect(result).toEqual([])
  })

  it('returns an empty list when the payload is not an array', async () => {
    mockFetch.mockResolvedValue(okResponse({ proposals: [validProposal()] }))

    const result = await fetchGovernanceProposals()

    expect(result).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('returns an empty list for an empty array', async () => {
    mockFetch.mockResolvedValue(okResponse([]))

    const result = await fetchGovernanceProposals()

    expect(result).toEqual([])
  })
})
