import type { Alert, AlertsContextType } from '../types'

/** The input type accepted by {@link AlertsContextType.addAlert}. */
type AddAlertInput = Parameters<AlertsContextType['addAlert']>[0]

/**
 * Builds a fully-formed {@link Alert} with safe defaults. Tests pass overrides
 * for exactly the fields they assert on, so fixture drift (a new required
 * field added to `Alert`) breaks here instead of in every test file.
 */
export function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    assetPair: 'BTC/USD',
    upperThreshold: 60000,
    lowerThreshold: null,
    triggerOnce: false,
    fireCount: 0,
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
    channels: null,
    retestMode: false,
    retestState: null,
    active: true,
    createdAt: 1_700_000_000_000,
    lastTriggeredAt: null,
    ...overrides,
  }
}

/**
 * Builds an object acceptable to {@link AlertsContextType.addAlert} — the full
 * `Alert` minus the runtime-owned fields the provider fills in on creation.
 */
export function makeAlertInput(
  overrides: Partial<
    Omit<
      Alert,
      | 'id'
      | 'createdAt'
      | 'lastTriggeredAt'
      | 'fireCount'
      | 'snoozedUntil'
      | 'percentageBaselinePrice'
      | 'percentageBaselineTimestamp'
      | 'escalationState'
      | 'channels'
      | 'retestState'
    >
  > = {},
): AddAlertInput {
  const alert = makeAlert(overrides as Partial<Alert>)
  const {
    id: _id,
    createdAt: _createdAt,
    lastTriggeredAt: _lastTriggeredAt,
    fireCount: _fireCount,
    snoozedUntil: _snoozedUntil,
    percentageBaselinePrice: _pctBaseline,
    percentageBaselineTimestamp: _pctBaselineAt,
    escalationState: _escalationState,
    channels,
    retestState: _retestState,
    ...input
  } = alert
  return { ...input, channels: channels ?? undefined } as AddAlertInput
}
