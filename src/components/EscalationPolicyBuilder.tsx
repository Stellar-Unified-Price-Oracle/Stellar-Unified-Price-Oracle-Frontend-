/**
 * @file EscalationPolicyBuilder
 *
 * Keyboard-accessible editor for an alert's escalation policy (#487): an ordered
 * sequence of notification channels fired at increasing delays while a breach
 * stays active. Validates that delays are non-decreasing via
 * {@link validateEscalationPolicy} and surfaces the errors inline.
 */
import { useMemo, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { EscalationStep, NotificationChannelId } from '../types'
import { nextConditionId, validateEscalationPolicy } from '../types/alerts'

interface EscalationPolicyBuilderProps {
  enabled: boolean
  steps: EscalationStep[]
  onChange: (enabled: boolean, steps: EscalationStep[]) => void
}

const CHANNELS: NotificationChannelId[] = ['inApp', 'email', 'webPush', 'webhook', 'telegram', 'discord']

export function EscalationPolicyBuilder({ enabled, steps, onChange }: EscalationPolicyBuilderProps): ReactElement {
  const { t } = useTranslation()
  const errors = useMemo(() => (enabled ? validateEscalationPolicy(steps) : []), [enabled, steps])

  const addStep = (): void => {
    const lastDelay = steps.length > 0 ? steps[steps.length - 1].delayMinutes : 0
    onChange(enabled, [...steps, { id: nextConditionId('step'), channel: 'inApp', delayMinutes: lastDelay }])
  }

  const updateStep = (id: string, updates: Partial<EscalationStep>): void => {
    onChange(
      enabled,
      steps.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    )
  }

  const removeStep = (id: string): void => {
    onChange(
      enabled,
      steps.filter((s) => s.id !== id),
    )
  }

  return (
    <div className="mb-5 p-3 bg-gray-800/50 border border-gray-700 rounded-xl">
      <label className="flex items-center gap-2 cursor-pointer mb-1">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked, steps)}
          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
        />
        <span className="text-sm font-medium text-gray-300">{t('alertModal.escalation.enable')}</span>
      </label>
      <p className="text-xs text-gray-500 mb-3">{t('alertModal.escalation.description')}</p>

      {enabled && (
        <>
          <ol className="space-y-2">
            {steps.map((step, index) => (
              <li key={step.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-4 shrink-0">{index + 1}.</span>

                <label htmlFor={`esc-channel-${step.id}`} className="sr-only">
                  {t('alertModal.escalation.channelLabel', { step: index + 1 })}
                </label>
                <select
                  id={`esc-channel-${step.id}`}
                  value={step.channel}
                  onChange={(e) => updateStep(step.id, { channel: e.target.value as NotificationChannelId })}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {t(`alertModal.escalation.channel_${channel}`)}
                    </option>
                  ))}
                </select>

                <label htmlFor={`esc-delay-${step.id}`} className="sr-only">
                  {t('alertModal.escalation.delayLabel', { step: index + 1 })}
                </label>
                <input
                  id={`esc-delay-${step.id}`}
                  type="number"
                  min="0"
                  step="1"
                  value={step.delayMinutes}
                  onChange={(e) => updateStep(step.id, { delayMinutes: Number.parseInt(e.target.value, 10) || 0 })}
                  className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-xs text-gray-500 shrink-0">{t('alertModal.escalation.minutesSuffix')}</span>

                <button
                  type="button"
                  onClick={() => removeStep(step.id)}
                  aria-label={t('alertModal.escalation.removeStep', { step: index + 1 })}
                  className="text-gray-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-400/10 transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={addStep}
            className="mt-2 text-xs px-2.5 py-1 rounded-lg border border-cyan-500/30 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
          >
            {t('alertModal.escalation.addStep')}
          </button>

          {errors.length > 0 && (
            <ul className="mt-2 space-y-0.5" role="alert">
              {errors.map((err) => (
                <li key={`${err.stepIndex}-${err.code}`} className="text-xs text-red-400">
                  {t(`alertModal.escalation.error_${err.code}`, { step: err.stepIndex + 1 })}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
