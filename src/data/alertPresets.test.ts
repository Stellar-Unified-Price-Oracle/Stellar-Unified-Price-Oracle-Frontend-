import { describe, it, expect } from 'vitest'
import { ALERT_PRESETS, getAlertPreset } from './alertPresets'
import { evaluateCompoundCondition } from '../utils/alertEvaluator'
import { validateEscalationPolicy } from '../types/alerts'

describe('ALERT_PRESETS', () => {
  it('ships exactly the three documented presets', () => {
    expect(ALERT_PRESETS.map((p) => p.id).sort()).toEqual(['breakout', 'peg-break', 'whale-move'])
  })

  it('every preset has non-empty i18n keys and a valid template', () => {
    for (const preset of ALERT_PRESETS) {
      expect(preset.nameKey).toMatch(/^alertPresets\./)
      expect(preset.descriptionKey).toMatch(/^alertPresets\./)
      expect(preset.useCaseKey).toMatch(/^alertPresets\./)
      expect(preset.template.suggestedAssetPair).toBeTruthy()
      expect(preset.template.conditionGroup.conditions.length).toBeGreaterThan(0)
    }
  })

  it('every preset escalation policy (when present) is valid (non-decreasing delays)', () => {
    for (const preset of ALERT_PRESETS) {
      if (!preset.template.escalationPolicy) continue
      expect(validateEscalationPolicy(preset.template.escalationPolicy.steps)).toEqual([])
    }
  })

  it('getAlertPreset finds a known preset and returns undefined for an unknown id', () => {
    expect(getAlertPreset('whale-move')?.id).toBe('whale-move')
    expect(getAlertPreset('does-not-exist')).toBeUndefined()
  })
})

describe('preset instantiation — compound logic behaves as documented', () => {
  it('"Whale Move" fires on a large move in either direction (OR)', () => {
    const { conditionGroup } = getAlertPreset('whale-move')!.template
    expect(evaluateCompoundCondition(conditionGroup, { price: 0, percentageChange: { '15min': 4 } })).toBe(true)
    expect(evaluateCompoundCondition(conditionGroup, { price: 0, percentageChange: { '15min': -4 } })).toBe(true)
    expect(evaluateCompoundCondition(conditionGroup, { price: 0, percentageChange: { '15min': 1 } })).toBe(false)
  })

  it('"Breakout" requires both windows to confirm momentum (AND)', () => {
    const { conditionGroup } = getAlertPreset('breakout')!.template
    // Both thresholds cleared
    expect(
      evaluateCompoundCondition(conditionGroup, { price: 0, percentageChange: { '1hr': 6, '15min': 3 } }),
    ).toBe(true)
    // 1hr cleared but 15min hasn't caught up yet
    expect(
      evaluateCompoundCondition(conditionGroup, { price: 0, percentageChange: { '1hr': 6, '15min': 0.5 } }),
    ).toBe(false)
  })

  it('"Stablecoin Peg Break" fires on deviation past either boundary (OR)', () => {
    const { conditionGroup } = getAlertPreset('peg-break')!.template
    expect(evaluateCompoundCondition(conditionGroup, { price: 1.02 })).toBe(true)
    expect(evaluateCompoundCondition(conditionGroup, { price: 0.98 })).toBe(true)
    expect(evaluateCompoundCondition(conditionGroup, { price: 1.0 })).toBe(false)
  })
})
