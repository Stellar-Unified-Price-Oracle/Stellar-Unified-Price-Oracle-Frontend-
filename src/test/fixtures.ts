import type { Alert, AlertsContextType, LivePriceEntry, PriceData } from '../types'

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
    expiresAt: null,
    reviewAt: null,
    archived: false,
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

/**
 * Builds a {@link PriceData} snapshot with safe defaults. Tests override only
 * the fields they assert on, so a shape change to `PriceData` surfaces here.
 */
export function makePriceData(overrides: Partial<PriceData> = {}): PriceData {
  return {
    price: 50000,
    change24h: 0,
    changePercent24h: 0,
    high24h: 50000,
    low24h: 50000,
    volume24h: 0,
    timestamp: 1_700_000_000_000,
    ...overrides,
  } as PriceData
}

/**
 * Builds a {@link LivePriceEntry} with safe defaults. Use this instead of
 * hand-written literals when constructing `Map<string, LivePriceEntry>`
 * fixtures so the entry shape stays in sync with the domain type.
 */
export function makeLivePriceEntry(
  overrides: Partial<LivePriceEntry> = {},
): LivePriceEntry {
  return {
    price: 50000,
    change24h: 0,
    changePercent24h: 0,
    high24h: 50000,
    low24h: 50000,
    volume24h: 0,
    timestamp: 1_700_000_000_000,
    ...overrides,
  } as LivePriceEntry
}

/**
 * Builds a `Map<string, LivePriceEntry>` from a record of per-symbol
 * overrides, defaulting each entry via {@link makeLivePriceEntry}.
 */
export function makeLivePriceMap(
  entries: Record<string, Partial<LivePriceEntry>> = {},
): Map<string, LivePriceEntry> {
  const map = new Map<string, LivePriceEntry>()
  for (const [symbol, overrides] of Object.entries(entries)) {
    map.set(symbol, makeLivePriceEntry(overrides))
  }
  return map
}
