import { describe, it, expect } from 'vitest'
import { evaluateCondition, evaluateCompoundCondition, combineConditions, buildConditionGroupFromFormData } from './alertEvaluator'
import { migrateLegacyAlertConditions } from '../types/alerts'
import type { AlertCondition, ConditionGroup, PriceEvaluationState, AlertFormData } from '../types'

function cond(overrides: Partial<AlertCondition> = {}): AlertCondition {
  return { id: 'c1', field: 'price', operator: 'gt', value: 100, ...overrides }
}

describe('evaluateCondition', () => {
  it('evaluates each operator against price', () => {
    const state: PriceEvaluationState = { price: 100 }
    expect(evaluateCondition(cond({ operator: 'gt', value: 99 }), state)).toBe(true)
    expect(evaluateCondition(cond({ operator: 'gt', value: 100 }), state)).toBe(false)
    expect(evaluateCondition(cond({ operator: 'gte', value: 100 }), state)).toBe(true)
    expect(evaluateCondition(cond({ operator: 'lt', value: 101 }), state)).toBe(true)
    expect(evaluateCondition(cond({ operator: 'lte', value: 100 }), state)).toBe(true)
    expect(evaluateCondition(cond({ operator: 'eq', value: 100 }), state)).toBe(true)
    expect(evaluateCondition(cond({ operator: 'eq', value: 99 }), state)).toBe(false)
  })

  it('reads percentageChange for the condition window, defaulting to 1hr', () => {
    const state: PriceEvaluationState = { price: 0, percentageChange: { '15min': 3, '1hr': 7 } }
    expect(evaluateCondition(cond({ field: 'percentageChange', operator: 'gte', value: 5, window: '15min' }), state)).toBe(false)
    expect(evaluateCondition(cond({ field: 'percentageChange', operator: 'gte', value: 5 }), state)).toBe(true)
  })

  it('treats a missing window entry as 0 change', () => {
    const state: PriceEvaluationState = { price: 0, percentageChange: {} }
    expect(evaluateCondition(cond({ field: 'percentageChange', operator: 'eq', value: 0 }), state)).toBe(true)
  })
})

describe('evaluateCompoundCondition — truth tables', () => {
  const above: AlertCondition = { id: 'a', field: 'price', operator: 'gt', value: 100 }
  const below: AlertCondition = { id: 'b', field: 'price', operator: 'lt', value: 50 }

  it.each([
    // [price, expected] for AND(price > 100, price < 200) i.e. a bounded range via AND
    [150, true],
    [250, false],
    [99, false],
  ])('AND: price %d -> %s', (price, expected) => {
    const group: ConditionGroup = {
      id: 'g',
      logic: 'AND',
      conditions: [
        { id: 'a', field: 'price', operator: 'gt', value: 100 },
        { id: 'b', field: 'price', operator: 'lt', value: 200 },
      ],
    }
    expect(evaluateCompoundCondition(group, { price })).toBe(expected)
  })

  it.each([
    [150, true], // > 100
    [10, true], // < 50
    [75, false], // neither
  ])('OR: price %d -> %s', (price, expected) => {
    const group: ConditionGroup = { id: 'g', logic: 'OR', conditions: [above, below] }
    expect(evaluateCompoundCondition(group, { price })).toBe(expected)
  })

  it('nested/mixed: AND(OR(a,b), c) truth table', () => {
    // (price > 100 OR price < 50) AND percentageChange >= 5
    const group: ConditionGroup = {
      id: 'root',
      logic: 'AND',
      conditions: [
        { id: 'inner', logic: 'OR', conditions: [above, below] },
        { id: 'pct', field: 'percentageChange', operator: 'gte', value: 5 },
      ],
    }
    // price satisfies inner OR, pct condition also satisfied -> true
    expect(evaluateCompoundCondition(group, { price: 150, percentageChange: { '1hr': 6 } })).toBe(true)
    // price satisfies inner OR, pct condition NOT satisfied -> false
    expect(evaluateCompoundCondition(group, { price: 150, percentageChange: { '1hr': 1 } })).toBe(false)
    // price fails inner OR entirely -> false regardless of pct
    expect(evaluateCompoundCondition(group, { price: 75, percentageChange: { '1hr': 6 } })).toBe(false)
  })

  it('nested/mixed: OR(AND(a,b), c) truth table', () => {
    const group: ConditionGroup = {
      id: 'root',
      logic: 'OR',
      conditions: [
        {
          id: 'inner',
          logic: 'AND',
          conditions: [
            { id: 'a', field: 'price', operator: 'gt', value: 100 },
            { id: 'b', field: 'price', operator: 'lt', value: 200 },
          ],
        },
        { id: 'c', field: 'percentageChange', operator: 'lte', value: -10 },
      ],
    }
    expect(evaluateCompoundCondition(group, { price: 150, percentageChange: { '1hr': 0 } })).toBe(true) // inner AND true
    expect(evaluateCompoundCondition(group, { price: 5, percentageChange: { '1hr': -20 } })).toBe(true) // fallback OR leaf true
    expect(evaluateCompoundCondition(group, { price: 5, percentageChange: { '1hr': 0 } })).toBe(false) // neither
  })

  it('empty AND group is vacuously true; empty OR group is false', () => {
    expect(evaluateCompoundCondition({ id: 'g', logic: 'AND', conditions: [] }, { price: 1 })).toBe(true)
    expect(evaluateCompoundCondition({ id: 'g', logic: 'OR', conditions: [] }, { price: 1 })).toBe(false)
  })
})

describe('combineConditions', () => {
  it('wraps a lone primary condition in a single-element group', () => {
    const primary = cond()
    const group = combineConditions(primary, [], 'AND')
    expect(group.logic).toBe('AND')
    expect(group.conditions).toEqual([primary])
  })

  it('combines primary + extras under the given logic', () => {
    const primary = cond({ id: 'p' })
    const extra = cond({ id: 'e', operator: 'lt', value: 10 })
    const group = combineConditions(primary, [extra], 'OR')
    expect(group.logic).toBe('OR')
    expect(group.conditions).toHaveLength(2)
  })
})

describe('migrateLegacyAlertConditions (#485 transparent migration)', () => {
  const base = {
    percentageMode: false,
    upperThreshold: null as number | null,
    lowerThreshold: null as number | null,
    percentageThreshold: null as number | null,
    percentageWindow: null,
    percentageDirection: null,
  }

  it('migrates a single upper threshold into a single-condition AND group', () => {
    const group = migrateLegacyAlertConditions({ ...base, upperThreshold: 100 })
    expect(group.logic).toBe('AND')
    expect(group.conditions).toHaveLength(1)
    expect(evaluateCompoundCondition(group, { price: 150 })).toBe(true)
    expect(evaluateCompoundCondition(group, { price: 50 })).toBe(false)
  })

  it('migrates upper+lower into an OR group matching legacy "crosses either boundary" behaviour', () => {
    const group = migrateLegacyAlertConditions({ ...base, upperThreshold: 100, lowerThreshold: 50 })
    expect(group.logic).toBe('OR')
    expect(evaluateCompoundCondition(group, { price: 150 })).toBe(true)
    expect(evaluateCompoundCondition(group, { price: 10 })).toBe(true)
    expect(evaluateCompoundCondition(group, { price: 75 })).toBe(false)
  })

  it('migrates a directional percentage alert into a single condition', () => {
    const group = migrateLegacyAlertConditions({
      ...base,
      percentageMode: true,
      percentageThreshold: 5,
      percentageWindow: '1hr',
      percentageDirection: 'up',
    })
    expect(group.conditions).toHaveLength(1)
    expect(evaluateCompoundCondition(group, { price: 0, percentageChange: { '1hr': 6 } })).toBe(true)
    expect(evaluateCompoundCondition(group, { price: 0, percentageChange: { '1hr': -6 } })).toBe(false)
  })

  it('migrates an "either" direction percentage alert into an OR group', () => {
    const group = migrateLegacyAlertConditions({
      ...base,
      percentageMode: true,
      percentageThreshold: 5,
      percentageWindow: '1hr',
      percentageDirection: 'either',
    })
    expect(group.logic).toBe('OR')
    expect(evaluateCompoundCondition(group, { price: 0, percentageChange: { '1hr': 6 } })).toBe(true)
    expect(evaluateCompoundCondition(group, { price: 0, percentageChange: { '1hr': -6 } })).toBe(true)
    expect(evaluateCompoundCondition(group, { price: 0, percentageChange: { '1hr': 1 } })).toBe(false)
  })

  it('produces an unsatisfiable group (no data loss/crash) when no threshold is set', () => {
    const group = migrateLegacyAlertConditions({ ...base })
    expect(evaluateCompoundCondition(group, { price: 999999 })).toBe(false)
  })

  it('is pure — the same input always produces an equivalent, independently-evaluable group', () => {
    const input = { ...base, upperThreshold: 100, lowerThreshold: 50 }
    const a = migrateLegacyAlertConditions(input)
    const b = migrateLegacyAlertConditions(input)
    expect(a).not.toBe(b) // fresh ids each call
    expect(evaluateCompoundCondition(a, { price: 150 })).toBe(evaluateCompoundCondition(b, { price: 150 }))
  })
})

describe('buildConditionGroupFromFormData', () => {
  const baseForm: AlertFormData = {
    assetPair: 'BTC/USD',
    upperThreshold: '',
    lowerThreshold: '',
    triggerOnce: false,
    percentageMode: false,
    percentageThreshold: '',
    percentageWindow: '1hr',
    percentageDirection: 'either',
    percentageRelativeTo: 'open',
    cooldownMinutes: '5',
    extraConditions: [],
    conditionsLogic: 'AND',
    escalationEnabled: false,
    escalationSteps: [],
  }

  it('builds an OR group from both thresholds when no extra conditions are added', () => {
    const group = buildConditionGroupFromFormData({ ...baseForm, upperThreshold: '100', lowerThreshold: '50' })
    expect(group.logic).toBe('OR')
    expect(evaluateCompoundCondition(group, { price: 150 })).toBe(true)
    expect(evaluateCompoundCondition(group, { price: 75 })).toBe(false)
  })

  it('folds extra conditions in under the chosen logic operator, one level up', () => {
    const extra: AlertCondition = { id: 'x', field: 'price', operator: 'lt', value: 90 }
    const group = buildConditionGroupFromFormData({
      ...baseForm,
      upperThreshold: '100',
      extraConditions: [extra],
      conditionsLogic: 'AND',
    })
    expect(group.logic).toBe('AND')
    // price=150 satisfies primary (>100) but not extra (<90) -> AND is false
    expect(evaluateCompoundCondition(group, { price: 150 })).toBe(false)
  })

  it('matches migrateLegacyAlertConditions output behaviourally when only the primary field is set', () => {
    const form = { ...baseForm, percentageMode: true, percentageThreshold: '5', percentageDirection: 'up' as const }
    const built = buildConditionGroupFromFormData(form)
    const migrated = migrateLegacyAlertConditions({
      percentageMode: true,
      upperThreshold: null,
      lowerThreshold: null,
      percentageThreshold: 5,
      percentageWindow: '1hr',
      percentageDirection: 'up',
    })
    const state: PriceEvaluationState = { price: 0, percentageChange: { '1hr': 7 } }
    expect(evaluateCompoundCondition(built, state)).toBe(evaluateCompoundCondition(migrated, state))
  })
})
