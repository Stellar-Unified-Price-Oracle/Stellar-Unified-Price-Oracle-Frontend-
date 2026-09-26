import { describe, it, expect, vi } from 'vitest'
import { recordAlertDispatch, getAlertLatencyStats, onSloBreach } from './alertSlo'

describe('alertSlo', () => {
  it('reports p50/p95 per class+channel and raises a meta-alert on breach', () => {
    const spy = vi.fn()
    onSloBreach(spy)
    for (let i = 0; i < 5; i++) recordAlertDispatch('threshold', 'webhook', 0, 9000)
    expect(getAlertLatencyStats('threshold', 'webhook').p95).toBe(9000)
    expect(spy).toHaveBeenCalled()
  })
  it('does not breach when fast', () => {
    for (let i = 0; i < 6; i++) expect(recordAlertDispatch('compound', 'inApp', 0, 100)).toBeNull()
  })
})
