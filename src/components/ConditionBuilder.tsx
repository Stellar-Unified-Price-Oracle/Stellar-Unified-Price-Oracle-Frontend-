/**
 * @file ConditionBuilder
 *
 * Keyboard-accessible AND/OR condition builder used inside `AlertModal` (#485).
 * Lets the user layer extra conditions on top of the primary threshold/percentage
 * field already in the form, combined via a single AND/OR operator.
 *
 * Every row reuses the same plain `<select>`/`<input>`/`<button>` primitives as the
 * rest of the modal, so it's fully operable with Tab/Enter/Space and needs no
 * custom key handling of its own.
 *
 * Scope note: to keep runtime evaluation correct without a multi-window baseline
 * tracker, extra conditions share the alert's single field mode — `price` in
 * absolute mode, `percentageChange` (on the alert's own window) in percentage mode.
 */
import { useTranslation } from 'react-i18next'
import type { ReactElement } from 'react'
import type { AlertCondition, ConditionOperator, LogicOperator, AlertTimeWindow } from '../types'
import { nextConditionId } from '../types/alerts'

interface ConditionBuilderProps {
  conditions: AlertCondition[]
  logic: LogicOperator
  percentageMode: boolean
  onChange: (conditions: AlertCondition[], logic: LogicOperator) => void
}

const OPERATORS: ConditionOperator[] = ['gt', 'gte', 'lt', 'lte', 'eq']
const WINDOWS: AlertTimeWindow[] = ['5min', '15min', '1hr', '24hr']

export function ConditionBuilder({ conditions, logic, percentageMode, onChange }: ConditionBuilderProps): ReactElement {
  const { t } = useTranslation()

  const addCondition = (): void => {
    const condition: AlertCondition = percentageMode
      ? { id: nextConditionId(), field: 'percentageChange', operator: 'gte', value: 0, window: '1hr' }
      : { id: nextConditionId(), field: 'price', operator: 'gt', value: 0 }
    onChange([...conditions, condition], logic)
  }

  const updateCondition = (id: string, updates: Partial<AlertCondition>): void => {
    onChange(
      conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      logic,
    )
  }

  const removeCondition = (id: string): void => {
    onChange(
      conditions.filter((c) => c.id !== id),
      logic,
    )
  }

  return (
    <div className="mb-5 p-3 bg-gray-800/50 border border-gray-700 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">{t('alertModal.conditions.title')}</span>
        <button
          type="button"
          onClick={addCondition}
          className="text-xs px-2.5 py-1 rounded-lg border border-cyan-500/30 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
        >
          {t('alertModal.conditions.add')}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">{t('alertModal.conditions.description')}</p>

      {conditions.length > 0 && (
        <>
          {/* AND/OR logic toggle, keyboard accessible via native buttons */}
          <div className="flex gap-2 mb-3" role="group" aria-label={t('alertModal.conditions.logicLabel')}>
            {(['AND', 'OR'] as LogicOperator[]).map((op) => (
              <button
                key={op}
                type="button"
                aria-pressed={logic === op}
                onClick={() => onChange(conditions, op)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  logic === op
                    ? 'bg-cyan-600 border-cyan-500 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {op === 'AND' ? t('alertModal.conditions.and') : t('alertModal.conditions.or')}
              </button>
            ))}
          </div>

          <ul className="space-y-2">
            {conditions.map((condition, index) => (
              <li key={condition.id} className="flex items-center gap-2">
                <label htmlFor={`cond-op-${condition.id}`} className="sr-only">
                  {t('alertModal.conditions.operatorLabel', { index: index + 1 })}
                </label>
                <select
                  id={`cond-op-${condition.id}`}
                  value={condition.operator}
                  onChange={(e) => updateCondition(condition.id, { operator: e.target.value as ConditionOperator })}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {t(`alertModal.conditions.operator_${op}`)}
                    </option>
                  ))}
                </select>

                <label htmlFor={`cond-val-${condition.id}`} className="sr-only">
                  {t('alertModal.conditions.valueLabel', { index: index + 1 })}
                </label>
                <input
                  id={`cond-val-${condition.id}`}
                  type="number"
                  step="any"
                  value={condition.value}
                  onChange={(e) => updateCondition(condition.id, { value: Number.parseFloat(e.target.value) || 0 })}
                  className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />

                {percentageMode && (
                  <>
                    <label htmlFor={`cond-win-${condition.id}`} className="sr-only">
                      {t('alertModal.conditions.windowLabel', { index: index + 1 })}
                    </label>
                    <select
                      id={`cond-win-${condition.id}`}
                      value={condition.window ?? '1hr'}
                      onChange={(e) => updateCondition(condition.id, { window: e.target.value as AlertTimeWindow })}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                      {WINDOWS.map((w) => (
                        <option key={w} value={w}>
                          {t(`alertModal.fields.window${w.charAt(0).toUpperCase() + w.slice(1)}`)}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <span className="text-xs text-gray-500 flex-1">
                  {percentageMode ? '%' : t('alertModal.conditions.priceUnit')}
                </span>

                <button
                  type="button"
                  onClick={() => removeCondition(condition.id)}
                  aria-label={t('alertModal.conditions.remove', { index: index + 1 })}
                  className="text-gray-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-400/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
