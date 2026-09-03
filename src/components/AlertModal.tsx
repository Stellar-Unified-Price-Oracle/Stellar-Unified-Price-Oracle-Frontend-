/**
 * @file AlertModal
 *
 * Modal dialog for creating, editing, and deleting price alerts. Supports both
 * fixed-threshold mode (above/below a price) and percentage-change mode.
 *
 * Returns `null` when `isOpen` is `false`.
 *
 * @example Opening for a new alert
 * ```tsx
 * <AlertModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onSave={handleSave}
 *   defaultAssetPair="BTC/USD"
 *   currentPrice={67432.10}
 * />
 * ```
 *
 * @example Opening to edit an existing alert
 * ```tsx
 * <AlertModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   onSave={handleSave}
 *   onDelete={handleDelete}
 *   alert={existingAlert}
 *   currentPrice={67432.10}
 * />
 * ```
 *
 * ## Props table
 * | prop               | type                        | required | description                                       |
 * |--------------------|-----------------------------|----------|---------------------------------------------------|
 * | `isOpen`           | `boolean`                   | yes      | Controls modal visibility                         |
 * | `onClose`          | `() => void`                | yes      | Called when the user dismisses the modal           |
 * | `onSave`           | `(data: AlertFormData) => void` | yes  | Called with validated form data on save           |
 * | `onDelete`         | `() => void`                | no       | Called when the delete button is pressed           |
 * | `onReEnable`       | `() => void`                | no       | Called to re-enable a fired-once alert             |
 * | `alert`            | `Alert \| null`             | no       | Pre-fills the form when editing an existing alert  |
 * | `currentPrice`     | `number`                    | no       | Shown as context next to the threshold fields      |
 * | `defaultAssetPair` | `string`                    | no       | Pre-fills the asset pair field for new alerts      |
 *
 * ## Validation rules
 * - Asset pair must not be empty.
 * - In fixed-threshold mode, at least one of upper or lower threshold must be set.
 * - Upper threshold must be greater than lower threshold when both are provided.
 * - In percentage mode, `percentageThreshold` must be a positive number.
 *
 * ## Edge cases
 * - **`isOpen = false`** — returns `null` with no DOM output.
 * - **Editing a fired-once alert** — shows a "Re-enable" button via `onReEnable`.
 * - **Switching modes** — switching between fixed and percentage mode resets the
 *   opposite mode's fields to avoid stale validation errors.
 *
 * ## Accessibility
 * - `useFocusTrap` keeps keyboard focus inside the modal while it is open.
 * - `Escape` key triggers `onClose`.
 * - All form inputs have associated `<label>` elements.
 * - The modal container has `role="dialog"` and `aria-modal="true"`.
 */
import { useState, useEffect, useRef, useCallback, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  Alert,
  AlertFormData,
  AlertTimeWindow,
  AlertPercentageDirection,
  AlertPercentageRelativeTo,
  AlertCondition,
  NotificationChannelId,
} from '../types'
import { validateEscalationPolicy } from '../types/alerts'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { buildConditionGroupFromFormData } from '../utils/alertEvaluator'
import { simulateAlert, type SimulatedPoint } from '../utils/alertSimulation'
import { loadNotifConfig, getEnabledChannels } from '../services/notificationConfig'
import type { AlertPreset } from '../data/alertPresets'
import { presetStorage, type CustomAlertPreset } from '../services/presetStorage'
import { AlertSimulationChart } from './AlertSimulationChart'
import { ConditionBuilder } from './ConditionBuilder'
import { EscalationPolicyBuilder } from './EscalationPolicyBuilder'
import { AlertPresetPicker } from './AlertPresetPicker'

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: AlertFormData) => void
  onDelete?: () => void
  onReEnable?: () => void
  alert?: Alert | null
  currentPrice?: number
  defaultAssetPair?: string
  /** When true the save button is disabled due to rate limiting. */
  rateLimited?: boolean
  /** Seconds until the rate limit resets (shown on the button during cooldown). */
  cooldownSec?: number
}

type ValidationErrors = Partial<Record<keyof AlertFormData, string>>

/**
 * #492 – Per-alert channel routing picker.
 *
 * Lets the user override the global channel defaults for one alert. Only the
 * channels that are currently configured+enabled globally are offered (a channel
 * that isn't configured can't be routed to). An empty selection means "use the
 * global defaults", which is the default and the natural deselection exit.
 */
function ChannelRoutingSelect({ value, onChange }: { value: NotificationChannelId[]; onChange: (ch: NotificationChannelId[]) => void }): ReactElement {
  const { t } = useTranslation()
  const available = getEnabledChannels(loadNotifConfig()).filter((c) => c !== 'inApp')

  const toggle = (channel: NotificationChannelId) => {
    onChange(value.includes(channel) ? value.filter((c) => c !== channel) : [...value, channel])
  }

  return (
    <div className="mb-6 p-3 bg-gray-800/50 border border-gray-700 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="block text-sm font-medium text-gray-300">{t('alertModal.channels.title')}</span>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {t('alertModal.channels.useGlobal')}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">{t('alertModal.channels.description')}</p>
      {available.length === 0 ? (
        <p className="text-xs text-amber-400/80">{t('alertModal.channels.noneConfigured')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {available.map((channel) => {
            const active = value.includes(channel)
            return (
              <button
                key={channel}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(channel)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                  active
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {t(`alertModal.escalation.channel_${channel}`)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
/**
 * #490 – "Test alert" simulation UI.
 *
 * Runs the current form through {@link simulateAlert} (same evaluation path as
 * live) and renders the mini-chart with fire markers. Purely local state — the
 * result is discarded when the modal closes and never touches alert history.
 */
function AlertSimulationSection({
  simResult,
  onRun,
  disabled,
}: {
  simResult: SimulatedPoint[] | null
  onRun: () => void
  disabled: boolean
}): ReactElement {
  const { t } = useTranslation()
  return (
    <div className="mb-6 p-3 bg-gray-800/50 border border-gray-700 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="block text-sm font-medium text-gray-300">{t('alertModal.simulate.title')}</span>
        <button
          type="button"
          onClick={onRun}
          disabled={disabled}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('alertModal.simulate.run')}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-2">{t('alertModal.simulate.description')}</p>
      {simResult ? (
        <AlertSimulationChart points={simResult} />
      ) : (
        <p className="text-xs text-gray-500 italic">{t('alertModal.simulate.idle')}</p>
      )}
    </div>
  )
}

export function AlertModal({ isOpen, onClose, onSave, onDelete, onReEnable, alert, currentPrice, defaultAssetPair, rateLimited = false, cooldownSec = 0 }: AlertModalProps): ReactElement | null {
  const { t } = useTranslation()

  function validate(form: AlertFormData): ValidationErrors {
    const errors: ValidationErrors = {}

    if (!form.assetPair.trim()) {
      errors.assetPair = t('alertModal.validation.assetPairRequired')
    }

    if (form.percentageMode) {
      const pct = form.percentageThreshold ? Number.parseFloat(form.percentageThreshold) : null
      if (pct === null || Number.isNaN(pct) || pct <= 0) {
        errors.percentageThreshold = t('alertModal.validation.mustBePositive')
      }
    } else {
      const upper = form.upperThreshold ? Number.parseFloat(form.upperThreshold) : null
      const lower = form.lowerThreshold ? Number.parseFloat(form.lowerThreshold) : null

      if (!upper && !lower) {
        errors.upperThreshold = t('alertModal.validation.atLeastOneThreshold')
        errors.lowerThreshold = t('alertModal.validation.atLeastOneThreshold')
        return errors
      }

      if (upper !== null) {
        if (Number.isNaN(upper) || upper <= 0) {
          errors.upperThreshold = t('alertModal.validation.mustBePositive')
        } else if (lower !== null && !Number.isNaN(lower) && upper <= lower) {
          errors.upperThreshold = t('alertModal.validation.upperGreaterThanLower')
        }
      }

      if (lower !== null) {
        if (Number.isNaN(lower) || lower <= 0) {
          errors.lowerThreshold = t('alertModal.validation.mustBePositive')
        } else if (upper !== null && !Number.isNaN(upper) && lower >= upper) {
          errors.lowerThreshold = t('alertModal.validation.lowerLessThanUpper')
        }
      }
    }

    return errors
  }

  const emptyForm = (): AlertFormData => ({
    assetPair: '',
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
    // #492 – empty means "use the global channel defaults".
    channels: [],
    // #491 – retest mode off by default.
    retestMode: false,
  })

  const [form, setForm] = useState<AlertFormData>(emptyForm)
  const [errors, setErrors] = useState<ValidationErrors>({})
  // #490 – cached result of the "Test alert" simulation for the current form.
  const [simResult, setSimResult] = useState<SimulatedPoint[] | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const { containerRef, handleKeyDown: trapKeyDown } = useFocusTrap()

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      if (alert) {
        setForm({
          assetPair: alert.assetPair,
          upperThreshold: alert.upperThreshold !== null ? String(alert.upperThreshold) : '',
          lowerThreshold: alert.lowerThreshold !== null ? String(alert.lowerThreshold) : '',
          triggerOnce: alert.triggerOnce,
          percentageMode: alert.percentageMode,
          percentageThreshold: alert.percentageThreshold !== null ? String(alert.percentageThreshold) : '',
          percentageWindow: alert.percentageWindow ?? '1hr',
          percentageDirection: alert.percentageDirection ?? 'either',
          percentageRelativeTo: alert.percentageRelativeTo ?? 'open',
          cooldownMinutes: String(alert.cooldownMinutes ?? 5),
          // #485 – the condition builder starts empty on edit; the alert's saved
          // conditionGroup may be an arbitrary tree that doesn't decompose back into
          // "primary + extras" cleanly, so editing only re-derives the primary field
          // above. Any extras added here are combined with it fresh on save.
          extraConditions: [],
          conditionsLogic: 'AND',
          // #487
          escalationEnabled: alert.escalationPolicy?.enabled ?? false,
          escalationSteps: alert.escalationPolicy?.steps ?? [],
          // #492
          channels: alert.channels ?? [],
          // #491
          retestMode: alert.retestMode,
        })
      } else {
        setForm(emptyForm())
      }
      setErrors({})
      setSimResult(null)

      requestAnimationFrame(() => {
        dialogRef.current?.focus()
      })
    } else {
      previousActiveElement.current?.focus()
    }
  }, [isOpen, alert, defaultAssetPair])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      trapKeyDown(e)
    },
    [onClose, trapKeyDown],
  )

  const setAndValidate = useCallback((field: keyof AlertFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const validationErrors = validate(form)
      setErrors(validationErrors)
      // #487 – an invalid escalation policy (e.g. out-of-order delays) blocks save;
      // EscalationPolicyBuilder already renders the specific errors inline.
      const escalationInvalid = form.escalationEnabled && validateEscalationPolicy(form.escalationSteps).length > 0
      if (Object.keys(validationErrors).length === 0 && !escalationInvalid) {
        onSave(form)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, onSave],
  )

  /**
   * #486 – Projects a preset's (possibly multi-condition) group onto the form.
   *
   * A group of exactly two opposite-signed conditions on the same field/window,
   * combined with OR, is exactly what the simple "direction: either" primary field
   * already expresses — so that shape maps back with zero extras. Anything else
   * (e.g. an AND-combined confirmation across two windows, like "Breakout") keeps
   * its first condition as the primary field and carries the rest over as extra
   * conditions verbatim, each with its own operator/value/window untouched.
   */
  function projectConditionGroupOntoForm(
    group: AlertPreset['template']['conditionGroup'],
    percentageMode: boolean,
    prev: AlertFormData,
  ): Partial<AlertFormData> {
    const conditions = group.conditions.filter((c): c is AlertCondition => 'field' in c)
    const gte = conditions.find((c) => c.operator === 'gte')
    const lte = conditions.find((c) => c.operator === 'lte')
    const isEitherPair =
      conditions.length === 2 &&
      group.logic === 'OR' &&
      gte !== undefined &&
      lte !== undefined &&
      gte.field === lte.field &&
      gte.window === lte.window

    if (isEitherPair) {
      const magnitude = Math.abs(gte.value)
      return percentageMode
        ? {
            percentageThreshold: String(magnitude),
            percentageDirection: 'either',
            percentageWindow: gte.window ?? '1hr',
            extraConditions: [],
            conditionsLogic: group.logic,
          }
        : { upperThreshold: String(gte.value), lowerThreshold: String(lte.value), extraConditions: [], conditionsLogic: group.logic }
    }

    const primary = conditions[0]
    const extras = conditions.slice(1)
    if (!primary) return { extraConditions: extras, conditionsLogic: group.logic }

    return percentageMode
      ? {
          percentageThreshold: String(Math.abs(primary.value)),
          percentageDirection: primary.operator === 'lte' ? 'down' : 'up',
          percentageWindow: primary.window ?? '1hr',
          extraConditions: extras,
          conditionsLogic: group.logic,
        }
      : {
          upperThreshold: primary.operator === 'lte' ? prev.upperThreshold : String(primary.value),
          lowerThreshold: primary.operator === 'lte' ? String(primary.value) : prev.lowerThreshold,
          extraConditions: extras,
          conditionsLogic: group.logic,
        }
  }

  const applyPreset = useCallback((preset: AlertPreset) => {
    const { template } = preset
    setForm((prev) => ({
      ...prev,
      assetPair: prev.assetPair || template.suggestedAssetPair,
      percentageMode: template.percentageMode,
      triggerOnce: template.triggerOnce,
      cooldownMinutes: String(template.cooldownMinutes),
      escalationEnabled: template.escalationPolicy?.enabled ?? false,
      escalationSteps: template.escalationPolicy?.steps ?? [],
      ...projectConditionGroupOntoForm(template.conditionGroup, template.percentageMode, prev),
    }))
  }, [])

  const applyCustomPreset = useCallback((preset: CustomAlertPreset) => {
    setForm((prev) => ({
      ...prev,
      assetPair: prev.assetPair || preset.suggestedAssetPair,
      percentageMode: preset.percentageMode,
      triggerOnce: preset.triggerOnce,
      cooldownMinutes: String(preset.cooldownMinutes),
      escalationEnabled: preset.escalationPolicy?.enabled ?? false,
      escalationSteps: preset.escalationPolicy?.steps ?? [],
      ...projectConditionGroupOntoForm(preset.conditionGroup, preset.percentageMode, prev),
    }))
  }, [])

  // #486 – save the form's current configuration as a reusable custom preset.
  const saveCurrentAsPreset = useCallback(
    async (name: string, description: string) => {
      await presetStorage.create({
        name,
        description,
        suggestedAssetPair: form.assetPair,
        percentageMode: form.percentageMode,
        conditionGroup: buildConditionGroupFromFormData(form),
        triggerOnce: form.triggerOnce,
        cooldownMinutes: form.cooldownMinutes ? Number.parseInt(form.cooldownMinutes, 10) : 5,
        escalationPolicy: form.escalationEnabled ? { enabled: true, steps: form.escalationSteps } : null,
      })
    },
    [form],
  )

  const setSuggestion = useCallback(
    (field: 'upperThreshold' | 'lowerThreshold', pct: number) => {
      if (currentPrice !== undefined) {
        const val = currentPrice * (1 + pct / 100)
        setAndValidate(field, val.toFixed(2))
      }
    },
    [currentPrice, setAndValidate],
  )

  const handleTestAlert = useCallback(() => {
    // Run against a base price derived from the form when no live price is
    // available, so the simulation is usable even while editing a new alert.
    const base =
      currentPrice !== undefined && currentPrice > 0
        ? currentPrice
        : Number.parseFloat(form.upperThreshold) ||
          Number.parseFloat(form.lowerThreshold) ||
          100
    setSimResult(simulateAlert(form, base))
  }, [form, currentPrice])

  if (!isOpen) return null

  const fieldError = (field: keyof AlertFormData): string | undefined => errors[field]

  const isFiredOnce = alert && alert.triggerOnce && !alert.active && alert.lastTriggeredAt !== null
  const isInactivePersistent = alert && !alert.triggerOnce && !alert.active

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        ref={(node) => {
          dialogRef.current = node
          ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        role="dialog"
        aria-modal="true"
        aria-label={alert ? t('alertModal.ariaLabelEdit') : t('alertModal.ariaLabelNew')}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl focus:outline-none max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {alert ? t('alertModal.titleEdit') : t('alertModal.titleNew')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-800"
            aria-label={t('alertModal.close')}
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Fired alert status (#312) */}
        {isFiredOnce && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-300 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              {t('alertModal.firedOnceNotice', {
                time: new Date(alert.lastTriggeredAt!).toLocaleString(),
                count: alert.fireCount,
              })}
            </div>
          </div>
        )}

        {/* Persistent alert fire count (#312) */}
        {alert && !alert.triggerOnce && alert.fireCount > 0 && (
          <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-sm text-cyan-300 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {t('alertModal.fireCount', { count: alert.fireCount })}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Preset library (#486) — only offered when creating a new alert, since an
              existing alert's fields are already configured. */}
          {!alert && (
            <AlertPresetPicker
              onSelectPreset={applyPreset}
              onSelectCustom={applyCustomPreset}
              onSaveCurrent={saveCurrentAsPreset}
            />
          )}

          {/* Asset Pair */}
          <div className="mb-4">
            <label htmlFor="alert-asset-pair" className="block text-sm font-medium text-gray-400 mb-1.5">
              {t('alertModal.fields.assetPair')}
            </label>
            <input
              id="alert-asset-pair"
              type="text"
              value={form.assetPair}
              onChange={(e) => setAndValidate('assetPair', e.target.value)}
              disabled={!!alert}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder={t('alertModal.fields.assetPairPlaceholder')}
            />
            {fieldError('assetPair') && (
              <p className="mt-1 text-sm text-red-400" role="alert">
                {fieldError('assetPair')}
              </p>
            )}
          </div>

          {/* Alert Mode Toggle: Absolute vs Percentage (#307) */}
          <div className="mb-5">
            <span className="block text-sm font-medium text-gray-400 mb-2">{t('alertModal.fields.alertMode')}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAndValidate('percentageMode', false)}
                className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-colors ${
                  !form.percentageMode
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {t('alertModal.fields.alertModeAbsolute')}
              </button>
              <button
                type="button"
                onClick={() => setAndValidate('percentageMode', true)}
                className={`flex-1 py-2 text-sm font-medium rounded-xl border transition-colors ${
                  form.percentageMode
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {t('alertModal.fields.alertModePercentage')}
              </button>
            </div>
          </div>

          {form.percentageMode ? (
            /* ── Percentage alert fields (#307) ──────────────────────────── */
            <div className="space-y-4 mb-5">
              {/* Percentage threshold */}
              <div>
                <label htmlFor="alert-pct-threshold" className="block text-sm font-medium text-gray-400 mb-1.5">
                  {t('alertModal.fields.percentageThreshold')}
                </label>
                <div className="relative">
                  <input
                    id="alert-pct-threshold"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={form.percentageThreshold}
                    onChange={(e) => setAndValidate('percentageThreshold', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="5"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
                {fieldError('percentageThreshold') && (
                  <p className="mt-1 text-sm text-red-400" role="alert">
                    {fieldError('percentageThreshold')}
                  </p>
                )}
              </div>

              {/* Time window */}
              <div>
                <label htmlFor="alert-pct-window" className="block text-sm font-medium text-gray-400 mb-1.5">
                  {t('alertModal.fields.percentageWindow')}
                </label>
                <select
                  id="alert-pct-window"
                  value={form.percentageWindow}
                  onChange={(e) => setAndValidate('percentageWindow', e.target.value as AlertTimeWindow)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                >
                  <option value="5min">{t('alertModal.fields.window5min')}</option>
                  <option value="15min">{t('alertModal.fields.window15min')}</option>
                  <option value="1hr">{t('alertModal.fields.window1hr')}</option>
                  <option value="24hr">{t('alertModal.fields.window24hr')}</option>
                </select>
              </div>

              {/* Direction */}
              <div>
                <span className="block text-sm font-medium text-gray-400 mb-2">{t('alertModal.fields.percentageDirection')}</span>
                <div className="flex gap-2">
                  {(['up', 'down', 'either'] as AlertPercentageDirection[]).map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      onClick={() => setAndValidate('percentageDirection', dir)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        form.percentageDirection === dir
                          ? 'bg-cyan-600 border-cyan-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {t(`alertModal.fields.direction${dir.charAt(0).toUpperCase() + dir.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Relative to */}
              <div>
                <label htmlFor="alert-pct-relative" className="block text-sm font-medium text-gray-400 mb-1.5">
                  {t('alertModal.fields.percentageRelativeTo')}
                </label>
                <select
                  id="alert-pct-relative"
                  value={form.percentageRelativeTo}
                  onChange={(e) => setAndValidate('percentageRelativeTo', e.target.value as AlertPercentageRelativeTo)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                >
                  <option value="open">{t('alertModal.fields.relativeToOpen')}</option>
                  <option value="previousClose">{t('alertModal.fields.relativeToPreviousClose')}</option>
                  <option value="movingAverage">{t('alertModal.fields.relativeToMovingAverage')}</option>
                </select>
              </div>
            </div>
          ) : (
            /* ── Absolute threshold fields ────────────────────────────────── */
            <>
              <div className="mb-4">
                <label htmlFor="alert-upper" className="block text-sm font-medium text-gray-400 mb-1.5">
                  {t('alertModal.fields.upperThreshold')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="alert-upper"
                    type="number"
                    step="any"
                    min="0"
                    value={form.upperThreshold}
                    onChange={(e) => setAndValidate('upperThreshold', e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder={t('alertModal.fields.upperPlaceholder')}
                  />
                  {currentPrice !== undefined && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSuggestion('upperThreshold', 5)}
                        className="px-2 py-1 text-xs font-medium text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-lg hover:bg-cyan-400/20 transition-colors"
                      >
                        +5%
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuggestion('upperThreshold', 10)}
                        className="px-2 py-1 text-xs font-medium text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-lg hover:bg-cyan-400/20 transition-colors"
                      >
                        +10%
                      </button>
                    </div>
                  )}
                </div>
                {fieldError('upperThreshold') && (
                  <p className="mt-1 text-sm text-red-400" role="alert">
                    {fieldError('upperThreshold')}
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor="alert-lower" className="block text-sm font-medium text-gray-400 mb-1.5">
                  {t('alertModal.fields.lowerThreshold')}
                </label>
                <div className="flex gap-2">
                  <input
                    id="alert-lower"
                    type="number"
                    step="any"
                    min="0"
                    value={form.lowerThreshold}
                    onChange={(e) => setAndValidate('lowerThreshold', e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder={t('alertModal.fields.lowerPlaceholder')}
                  />
                  {currentPrice !== undefined && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSuggestion('lowerThreshold', -5)}
                        className="px-2 py-1 text-xs font-medium text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-lg hover:bg-cyan-400/20 transition-colors"
                      >
                        -5%
                      </button>
                      <button
                        type="button"
                        onClick={() => setSuggestion('lowerThreshold', -10)}
                        className="px-2 py-1 text-xs font-medium text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-lg hover:bg-cyan-400/20 transition-colors"
                      >
                        -10%
                      </button>
                    </div>
                  )}
                </div>
                {fieldError('lowerThreshold') && (
                  <p className="mt-1 text-sm text-red-400" role="alert">
                    {fieldError('lowerThreshold')}
                  </p>
                )}
              </div>
            </>
          )}

          {/* Additional AND/OR conditions (#485) */}
          <ConditionBuilder
            conditions={form.extraConditions}
            logic={form.conditionsLogic}
            percentageMode={form.percentageMode}
            onChange={(extraConditions, conditionsLogic) => setForm((prev) => ({ ...prev, extraConditions, conditionsLogic }))}
          />

          {/* Alert Type: One-time vs Persistent (#312) */}
          <div className="mb-6 p-3 bg-gray-800/50 border border-gray-700 rounded-xl">
            <span className="block text-sm font-medium text-gray-300 mb-2">{t('alertModal.fields.alertType')}</span>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setAndValidate('triggerOnce', true)}
                className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${
                  form.triggerOnce
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {t('alertModal.fields.alertTypeOneTime')}
              </button>
              <button
                type="button"
                onClick={() => setAndValidate('triggerOnce', false)}
                className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${
                  !form.triggerOnce
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {t('alertModal.fields.alertTypePersistent')}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {form.triggerOnce
                ? t('alertModal.fields.alertTypeOneTimeDesc')
                : t('alertModal.fields.alertTypePersistentDesc')}
            </p>

            {/* Cooldown between re-fires (#310) */}
            {!form.triggerOnce && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <label htmlFor="alert-cooldown" className="block text-xs font-medium text-gray-400 mb-1.5">
                  {t('alertModal.fields.cooldown')}
                </label>
                <select
                  id="alert-cooldown"
                  value={form.cooldownMinutes}
                  onChange={(e) => setAndValidate('cooldownMinutes', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                >
                  <option value="0">{t('alertModal.fields.cooldownOff')}</option>
                  <option value="1">{t('alertModal.fields.cooldown1min')}</option>
                  <option value="5">{t('alertModal.fields.cooldown5min')}</option>
                  <option value="15">{t('alertModal.fields.cooldown15min')}</option>
                  <option value="60">{t('alertModal.fields.cooldown1hr')}</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">{t('alertModal.fields.cooldownDesc')}</p>
              </div>
            )}
          </div>

          {/* Escalation policy (#487) */}
          <EscalationPolicyBuilder
            enabled={form.escalationEnabled}
            steps={form.escalationSteps}
            onChange={(escalationEnabled, escalationSteps) => setForm((prev) => ({ ...prev, escalationEnabled, escalationSteps }))}
          />

          {/* Price-level retest detection (#491) */}
          <div className="mb-6 p-3 bg-gray-800/50 border border-gray-700 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.retestMode}
                onChange={(e) => setAndValidate('retestMode', e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/50"
              />
              <span className="text-sm font-medium text-gray-300">{t('alertModal.retest.title')}</span>
            </label>
            <p className="text-xs text-gray-500 mt-1.5">{t('alertModal.retest.description')}</p>
          </div>

          {/* Per-alert channel routing (#492) */}
          <ChannelRoutingSelect
            value={form.channels}
            onChange={(channels) => setForm((prev) => ({ ...prev, channels }))}
          />

          {/* Alert simulation (#490) */}
          <AlertSimulationSection
            simResult={simResult}
            onRun={handleTestAlert}
            disabled={
              form.percentageMode
                ? !form.percentageThreshold.trim()
                : !form.upperThreshold.trim() && !form.lowerThreshold.trim()
            }
          />

          <div className="flex gap-3">
            {onDelete && alert && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2.5 text-sm font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl hover:bg-red-400/20 transition-colors"
              >
                {t('alertModal.actions.delete')}
              </button>
            )}
            {/* Re-enable fired one-time alert (#312) */}
            {(isFiredOnce || isInactivePersistent) && onReEnable && (
              <button
                type="button"
                onClick={onReEnable}
                className="px-4 py-2.5 text-sm font-medium text-green-400 bg-green-400/10 border border-green-400/20 rounded-xl hover:bg-green-400/20 transition-colors"
              >
                {t('alertModal.actions.reEnable')}
              </button>
            )}
            <div className="flex-1 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
              >
                {t('alertModal.actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={rateLimited}
                className="px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 rounded-xl hover:bg-cyan-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                title={rateLimited ? `Too many alerts — try again in ${cooldownSec}s` : undefined}
              >
                {rateLimited
                  ? `${cooldownSec}s`
                  : alert
                    ? t('alertModal.actions.save')
                    : t('alertModal.actions.create')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
