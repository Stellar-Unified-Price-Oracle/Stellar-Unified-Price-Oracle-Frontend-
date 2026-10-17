/**
 * Dialog for choosing which optional dashboard table columns to show (#813).
 *
 * Changes are staged in a draft and shown in a live preview. Apply commits the draft,
 * Cancel and Escape discard it, and Reset restores the default column set in one click.
 *
 * Pair and price are always shown, so they are not in the list.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { TOGGLEABLE_TABLE_COLUMNS } from '../preferences/constants'
import type { ToggleableTableColumn } from '../preferences/types'

const LABEL_KEYS = {
  confidence: 'table.columns.confidence',
  sources: 'table.columns.sources',
  timestamp: 'table.columns.updated',
} as const

const SAMPLE_VALUES: Record<ToggleableTableColumn | 'assetPair' | 'price', string> = {
  assetPair: 'BTC/USD',
  price: '$64,250.00',
  confidence: '98.2%',
  sources: 'chainlink, band',
  timestamp: '2m ago',
}

const NO_HIDDEN_COLUMNS: ToggleableTableColumn[] = []

interface TableColumnsDialogProps {
  /** Columns currently hidden in the saved preference. */
  hidden: ToggleableTableColumn[]
  onApply: (hidden: ToggleableTableColumn[]) => void
  onClose: () => void
}

export function TableColumnsDialog({ hidden, onApply, onClose }: TableColumnsDialogProps): ReactElement {
  const { t } = useTranslation()
  const titleId = useId()
  const [draft, setDraft] = useState<ToggleableTableColumn[]>(hidden)
  const firstCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstCheckboxRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isVisible = (key: ToggleableTableColumn) => !draft.includes(key)
  const previewColumns: Array<ToggleableTableColumn | 'assetPair' | 'price'> = [
    'assetPair',
    'price',
    ...TOGGLEABLE_TABLE_COLUMNS.filter(isVisible),
  ]
  const labelFor = (key: ToggleableTableColumn | 'assetPair' | 'price') =>
    key === 'assetPair' ? t('table.columns.pair') : key === 'price' ? t('table.columns.price') : t(LABEL_KEYS[key])

  const toggle = useCallback((key: ToggleableTableColumn, show: boolean) => {
    setDraft((prev) => (show ? prev.filter((k) => k !== key) : [...prev, key]))
  }, [])

  const apply = () => onApply(TOGGLEABLE_TABLE_COLUMNS.filter((key) => draft.includes(key)))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-5 text-gray-100"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          Table columns
        </h2>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm text-gray-300">Optional columns</legend>
          <div className="flex flex-col gap-1">
            {TOGGLEABLE_TABLE_COLUMNS.map((key, index) => (
              <label key={key} className="flex items-center gap-2 py-1 text-sm">
                <input
                  ref={index === 0 ? firstCheckboxRef : undefined}
                  type="checkbox"
                  checked={isVisible(key)}
                  onChange={(e) => toggle(key, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/50"
                />
                {t(LABEL_KEYS[key])}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <p className="mb-1 text-xs uppercase tracking-wider text-gray-500">Preview</p>
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table aria-label="Table column preview" className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {previewColumns.map((key) => (
                    <th key={key} scope="col" className="px-3 py-2 text-start text-xs font-semibold text-gray-400">
                      {labelFor(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {previewColumns.map((key) => (
                    <td key={key} className="whitespace-nowrap px-3 py-2 text-gray-200">
                      {SAMPLE_VALUES[key]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onApply(NO_HIDDEN_COLUMNS)}
            className="min-h-[44px] rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            Reset to default
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              className="min-h-[44px] rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
