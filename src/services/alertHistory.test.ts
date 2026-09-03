import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadAlertHistory,
  saveAlertHistory,
  buildTriggerHistoryEntry,
  buildEscalationHistoryEntry,
  appendHistoryEntries,
  HISTORY_LIMIT,
} from './alertHistory'
import type { Alert, EscalationStep } from '../types'

const STORAGE_KEY = 'alert-history'

const mockAlert: Alert = {
  id: 'a1',
  assetPair: 'BTC/USD',
  upperThreshold: 60000,
  lowerThreshold: null,
  triggerOnce: false,
  fireCount: 1,
  percentageMode: false,
  percentageThreshold: null,
  percentageWindow: null,
  percentageDirection: null,
  percentageRelativeTo: null,
  percentageBaselinePrice: null,
  percentageBaselineTimestamp: null,
  snoozedUntil: null,
  cooldownMinutes: 5,
  conditionGroup: null,
  escalationPolicy: null,
  escalationState: null,
  active: true,
  createdAt: Date.now(),
  lastTriggeredAt: null,
}

beforeEach(() => {
  localStorage.clear()
})

describe('loadAlertHistory / saveAlertHistory', () => {
  it('returns an empty array when nothing is stored', () => {
    expect(loadAlertHistory()).toEqual([])
  })

  it('round-trips a saved history', () => {
    const entry = buildTriggerHistoryEntry(mockAlert, 61000, Date.now())
    saveAlertHistory([entry])
    expect(loadAlertHistory()).toHaveLength(1)
    expect(loadAlertHistory()[0].alertId).toBe('a1')
  })

  it('resets to empty on corrupt storage rather than throwing', () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    expect(loadAlertHistory()).toEqual([])
  })

  it('resets to empty when the stored shape fails schema validation', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ nope: true }]))
    expect(loadAlertHistory()).toEqual([])
  })
})

describe('buildTriggerHistoryEntry', () => {
  it('builds a plain trigger entry with escalation left null', () => {
    const entry = buildTriggerHistoryEntry(mockAlert, 61000, 1000)
    expect(entry.escalation).toBeNull()
    expect(entry.price).toBe(61000)
    expect(entry.triggeredAt).toBe(1000)
    expect(entry.assetPair).toBe('BTC/USD')
  })
})

describe('buildEscalationHistoryEntry', () => {
  const step: EscalationStep = { id: 'step-1', channel: 'webhook', delayMinutes: 15 }

  it('builds an entry carrying the escalation step metadata', () => {
    const entry = buildEscalationHistoryEntry(mockAlert, step, 61000, 2000)
    expect(entry.escalation).toEqual({ stepId: 'step-1', channel: 'webhook', delayMinutes: 15 })
    expect(entry.triggeredAt).toBe(2000)
  })

  it('gets a distinct id from a trigger entry built for the same moment', () => {
    const trigger = buildTriggerHistoryEntry(mockAlert, 61000, 2000)
    const escalation = buildEscalationHistoryEntry(mockAlert, step, 61000, 2000)
    expect(escalation.id).not.toBe(trigger.id)
  })
})

describe('appendHistoryEntries', () => {
  it('prepends new entries newest-first', () => {
    const e1 = buildTriggerHistoryEntry(mockAlert, 1, 1)
    const e2 = buildTriggerHistoryEntry(mockAlert, 2, 2)
    const existing = [buildTriggerHistoryEntry(mockAlert, 0, 0)]
    const result = appendHistoryEntries(existing, [e1, e2])
    expect(result.map((e) => e.price)).toEqual([2, 1, 0])
  })

  it('caps the result at the given limit, dropping the oldest', () => {
    const existing = Array.from({ length: 5 }, (_, i) => buildTriggerHistoryEntry(mockAlert, i, i))
    const incoming = [buildTriggerHistoryEntry(mockAlert, 99, 99)]
    const result = appendHistoryEntries(existing, incoming, 3)
    expect(result).toHaveLength(3)
    expect(result[0].price).toBe(99)
  })

  it('defaults to HISTORY_LIMIT when no limit is given', () => {
    const existing = Array.from({ length: HISTORY_LIMIT }, (_, i) => buildTriggerHistoryEntry(mockAlert, i, i))
    const result = appendHistoryEntries(existing, [buildTriggerHistoryEntry(mockAlert, -1, -1)])
    expect(result).toHaveLength(HISTORY_LIMIT)
  })

  it('is a no-op that returns the same reference when there are no new entries', () => {
    const existing = [buildTriggerHistoryEntry(mockAlert, 0, 0)]
    expect(appendHistoryEntries(existing, [])).toBe(existing)
  })
})
