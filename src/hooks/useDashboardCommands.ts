/**
 * Registers the commands that only make sense on the Dashboard: jumping to a
 * price pair, adjusting filters/sort, creating an alert, and exporting.
 *
 * These commands are split into two registrations so a filter change (which
 * rebuilds the URL params) never re-registers the — potentially thousands of —
 * price-pair commands. Volatile callbacks are read through a ref for the same
 * reason: they close over `filtered`, which changes on every price tick.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { KNOWN_SOURCES, countActiveFilters, readFilterState } from '../components/FilterPanel'
import { useRegisterCommands } from '../context/CommandRegistryContext'
import type { Command } from '../types/commands'
import type { ExportFormat } from './useExport'

export interface DashboardCommandOptions {
  pairs: readonly string[]
  hasExportData: boolean
  exportAllowed: boolean
  exportCooldownSec: number
  onExport: (format: ExportFormat) => void
  onOpenColumnSelector: () => void
  onCreateAlert: () => void
}

const UPDATED_WITHIN_VALUES = ['all', '1h', '6h', '24h', '7d'] as const

const SORT_OPTIONS = [
  { value: 'pair', labelKey: 'filter.sort.pair' },
  { value: 'price-high', labelKey: 'filter.sort.priceHigh' },
  { value: 'price-low', labelKey: 'filter.sort.priceLow' },
  { value: 'confidence', labelKey: 'filter.sort.confidence' },
  { value: 'recent', labelKey: 'filter.sort.recent' },
] as const

const FILTER_PARAM_KEYS = [
  'sources',
  'minConf',
  'maxConf',
  'minPrice',
  'maxPrice',
  'updatedWithin',
  'sort',
  'sortDir',
] as const

const EXPORT_FORMATS: readonly ExportFormat[] = ['csv', 'json', 'xlsx']

export function useDashboardCommands(options: DashboardCommandOptions): void {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()

  const optionsRef = useRef(options)
  // Refresh after commit (never during render) so handlers read the latest
  // callbacks without forcing the command list to be rebuilt on every render.
  useEffect(() => {
    optionsRef.current = options
  })

  const { pairs, hasExportData, exportAllowed, exportCooldownSec } = options

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      if (value) params.set(key, value)
      else params.delete(key)
      navigate({ search: params.toString() }, { replace: true })
    },
    [searchParams, navigate],
  )

  // ── Price pairs (one command per feed) ─────────────────────────────────────
  const pairCommands = useMemo<Command[]>(
    () =>
      pairs.map((pair) => ({
        id: `pair:${pair}`,
        label: pair,
        category: 'pricePairs',
        hint: `/prices/${pair}`,
        keywords: pair.includes('/') ? [pair.replace('/', ' ')] : undefined,
        handler: () => navigate(`/prices/${encodeURIComponent(pair)}`),
      })),
    [pairs, navigate],
  )

  // ── Filters, sort, alerts, exports ─────────────────────────────────────────
  const actionCommands = useMemo<Command[]>(() => {
    const filters = readFilterState(searchParams)
    const list: Command[] = []

    list.push({
      id: 'filters:clear',
      label: t('commandPalette.filters.clear'),
      category: 'filters',
      enabled: countActiveFilters(filters) > 0,
      handler: () => {
        const params = new URLSearchParams(searchParams)
        for (const key of FILTER_PARAM_KEYS) params.delete(key)
        navigate({ search: params.toString() }, { replace: true })
      },
    })

    for (const source of KNOWN_SOURCES) {
      list.push({
        id: `filters:source:${source}`,
        label: t('commandPalette.filters.sourceOnly', {
          source: source.charAt(0).toUpperCase() + source.slice(1),
        }),
        category: 'filters',
        keywords: [source],
        enabled: !(filters.sources.length === 1 && filters.sources[0] === source),
        handler: () => setParam('sources', source),
      })
    }

    list.push({
      id: 'filters:source:all',
      label: t('commandPalette.filters.allSources'),
      category: 'filters',
      enabled: filters.sources.length > 0,
      handler: () => setParam('sources', ''),
    })

    for (const value of UPDATED_WITHIN_VALUES) {
      list.push({
        id: `filters:updated:${value}`,
        label: t('commandPalette.filters.updatedWithin', {
          window: t(`filter.updatedWithin.${value}`),
        }),
        category: 'filters',
        enabled: filters.updatedWithin !== value,
        handler: () => setParam('updatedWithin', value === 'all' ? '' : value),
      })
    }

    for (const option of SORT_OPTIONS) {
      list.push({
        id: `filters:sort:${option.value}`,
        label: t('commandPalette.filters.sortBy', { field: t(option.labelKey) }),
        category: 'filters',
        enabled: filters.sort !== option.value,
        handler: () => setParam('sort', option.value),
      })
    }

    list.push({
      id: 'filters:sort-direction',
      label: t('commandPalette.filters.toggleDirection'),
      category: 'filters',
      enabled: filters.sort !== '',
      handler: () => setParam('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc'),
    })

    // ── Alerts ───────────────────────────────────────────────────────────────
    list.push({
      id: 'alerts:create',
      label: t('commandPalette.alerts.create'),
      category: 'alerts',
      handler: () => optionsRef.current.onCreateAlert(),
    })

    // ── Exports ──────────────────────────────────────────────────────────────
    const disabledReason = !hasExportData
      ? t('commandPalette.exports.disabledNoData')
      : !exportAllowed
        ? t('commandPalette.exports.disabledRateLimited', { seconds: exportCooldownSec })
        : undefined

    for (const format of EXPORT_FORMATS) {
      list.push({
        id: `exports:${format}`,
        label: t(`commandPalette.exports.${format}`),
        category: 'exports',
        enabled: disabledReason === undefined,
        disabledReason,
        handler: () => optionsRef.current.onExport(format),
      })
    }

    list.push({
      id: 'exports:columns',
      label: t('commandPalette.exports.columns'),
      category: 'exports',
      handler: () => optionsRef.current.onOpenColumnSelector(),
    })

    return list
  }, [searchParams, navigate, setParam, t, hasExportData, exportAllowed, exportCooldownSec])

  useRegisterCommands(pairCommands)
  useRegisterCommands(actionCommands)
}
