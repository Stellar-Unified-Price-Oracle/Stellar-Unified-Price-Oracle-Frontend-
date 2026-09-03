/**
 * @file Built-in alert preset library (#486).
 *
 * A preset is a ready-made template for a common monitoring scenario — picking one
 * in `AlertModal` fills in the form (asset pair suggestion, condition group, cooldown,
 * escalation policy) in one click. Presets are pre-configured with the compound
 * condition groups introduced by #485, so a single preset can express logic a
 * simple threshold/percentage field cannot (e.g. "either boundary" or "confirmed
 * momentum across two windows").
 *
 * Names/descriptions/use-cases are i18n keys resolved via `t()` in the UI (see
 * `src/i18n/locales/en.ts`'s `alertPresets` namespace), not raw strings, so the
 * library is fully localized.
 *
 * User-authored presets are a separate, persisted concept — see
 * `src/services/presetStorage.ts`.
 */
import type { AlertCondition, ConditionGroup, EscalationPolicy } from '../types'
import { nextConditionId } from '../types/alerts'

/** What choosing a preset pre-fills into the alert form. */
export interface AlertPresetTemplate {
  /** Suggested asset pair; the user can still change it before saving. */
  suggestedAssetPair: string
  percentageMode: boolean
  conditionGroup: ConditionGroup
  triggerOnce: boolean
  cooldownMinutes: number
  escalationPolicy: EscalationPolicy | null
}

export interface AlertPreset {
  id: string
  /** i18n key under `alertPresets.<id>.name` etc. */
  nameKey: string
  descriptionKey: string
  useCaseKey: string
  icon: 'whale' | 'breakout' | 'peg' | 'custom'
  template: AlertPresetTemplate
}

function pctCondition(operator: 'gte' | 'lte', value: number, window: AlertCondition['window'] = '1hr'): AlertCondition {
  return { id: nextConditionId(), field: 'percentageChange', operator, value, window }
}

function priceCondition(operator: AlertCondition['operator'], value: number): AlertCondition {
  return { id: nextConditionId(), field: 'price', operator, value }
}

/**
 * "Whale Move" — a sudden large price swing in either direction over a short
 * window, the signature of a large holder moving the market. OR logic: either
 * direction trips it.
 */
const whaleMove: AlertPreset = {
  id: 'whale-move',
  nameKey: 'alertPresets.whaleMove.name',
  descriptionKey: 'alertPresets.whaleMove.description',
  useCaseKey: 'alertPresets.whaleMove.useCase',
  icon: 'whale',
  template: {
    suggestedAssetPair: 'BTC/USD',
    percentageMode: true,
    conditionGroup: {
      id: nextConditionId('grp'),
      logic: 'OR',
      conditions: [pctCondition('gte', 3, '15min'), pctCondition('lte', -3, '15min')],
    },
    triggerOnce: false,
    cooldownMinutes: 15,
    escalationPolicy: {
      enabled: true,
      steps: [
        { id: nextConditionId('step'), channel: 'inApp', delayMinutes: 0 },
        { id: nextConditionId('step'), channel: 'webhook', delayMinutes: 15 },
      ],
    },
  },
}

/**
 * "Breakout" — momentum confirmed across two windows: a strong 1-hour move that is
 * still accelerating in the most recent 15 minutes. AND logic: both must hold.
 */
const breakout: AlertPreset = {
  id: 'breakout',
  nameKey: 'alertPresets.breakout.name',
  descriptionKey: 'alertPresets.breakout.description',
  useCaseKey: 'alertPresets.breakout.useCase',
  icon: 'breakout',
  template: {
    suggestedAssetPair: 'ETH/USD',
    percentageMode: true,
    conditionGroup: {
      id: nextConditionId('grp'),
      logic: 'AND',
      conditions: [pctCondition('gte', 5, '1hr'), pctCondition('gte', 2, '15min')],
    },
    triggerOnce: false,
    cooldownMinutes: 30,
    escalationPolicy: {
      enabled: true,
      steps: [{ id: nextConditionId('step'), channel: 'inApp', delayMinutes: 0 }],
    },
  },
}

/**
 * "Stablecoin Peg Break" — price drifts more than 1% away from its $1.00 peg in
 * either direction. OR logic: either boundary trips it. One-time by default, since
 * a peg break is a discrete event worth investigating rather than a recurring one.
 */
const pegBreak: AlertPreset = {
  id: 'peg-break',
  nameKey: 'alertPresets.pegBreak.name',
  descriptionKey: 'alertPresets.pegBreak.description',
  useCaseKey: 'alertPresets.pegBreak.useCase',
  icon: 'peg',
  template: {
    suggestedAssetPair: 'USDC/USD',
    percentageMode: false,
    conditionGroup: {
      id: nextConditionId('grp'),
      logic: 'OR',
      conditions: [priceCondition('gte', 1.01), priceCondition('lte', 0.99)],
    },
    triggerOnce: true,
    cooldownMinutes: 5,
    escalationPolicy: {
      enabled: true,
      steps: [
        { id: nextConditionId('step'), channel: 'inApp', delayMinutes: 0 },
        { id: nextConditionId('step'), channel: 'email', delayMinutes: 5 },
        { id: nextConditionId('step'), channel: 'webhook', delayMinutes: 30 },
      ],
    },
  },
}

/** The built-in preset library shown at the top of `AlertModal` when creating a new alert. */
export const ALERT_PRESETS: readonly AlertPreset[] = [whaleMove, breakout, pegBreak]

/** Looks up a built-in preset by id, or `undefined` if unknown. */
export function getAlertPreset(id: string): AlertPreset | undefined {
  return ALERT_PRESETS.find((p) => p.id === id)
}
