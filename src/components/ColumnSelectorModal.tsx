import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useDragSort } from '../hooks/useDragSort'
import {
  COLUMN_PRESETS,
  EXPORT_COLUMNS,
  type ColumnPresetName,
  type ExportColumnKey,
} from '../utils/exportColumns'

const PRESET_NAMES: ColumnPresetName[] = ['minimal', 'standard', 'full']
const LABELS = Object.fromEntries(EXPORT_COLUMNS.map((c) => [c.key, c.label])) as Record<ExportColumnKey, string>

interface DraggableColumnListProps {
  columns: ExportColumnKey[]
  onChange: (columns: ExportColumnKey[]) => void
  onRemove: (key: ExportColumnKey) => void
}

function DraggableColumnList({ columns, onChange, onRemove }: DraggableColumnListProps): ReactElement {
  const { items, dragState, getItemProps } = useDragSort<ExportColumnKey>(columns, onChange)

  return (
    <ul className="space-y-1" aria-label="Selected export columns, drag to reorder">
      {items.map((key, i) => (
        <li
          key={key}
          {...getItemProps(i)}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-sm cursor-move bg-gray-800 text-gray-200 transition-colors ${
            dragState.dragIndex === i ? 'opacity-40' : ''
          } ${dragState.overIndex === i ? 'border-cyan-500' : 'border-gray-700'}`}
        >
          <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M7 4a1 1 0 100 2 1 1 0 000-2zM7 9a1 1 0 100 2 1 1 0 000-2zM7 14a1 1 0 100 2 1 1 0 000-2zM13 4a1 1 0 100 2 1 1 0 000-2zM13 9a1 1 0 100 2 1 1 0 000-2zM13 14a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
          <span className="flex-1">{LABELS[key]}</span>
          <button
            type="button"
            onClick={() => onRemove(key)}
            className="text-gray-500 hover:text-red-400 transition-colors"
            aria-label={`Remove ${LABELS[key]} column`}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

interface ColumnSelectorModalProps {
  format: string
  columns: ExportColumnKey[]
  onChange: (columns: ExportColumnKey[]) => void
  onApplyPreset: (preset: ColumnPresetName) => void
  onClose: () => void
}

export function ColumnSelectorModal({
  format,
  columns,
  onChange,
  onApplyPreset,
  onClose,
}: ColumnSelectorModalProps): ReactElement {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const filtered = EXPORT_COLUMNS.filter((c) => c.label.toLowerCase().includes(search.toLowerCase()))

  const toggle = (key: ExportColumnKey) => {
    if (columns.includes(key)) {
      if (columns.length === 1) return
      onChange(columns.filter((c) => c !== key))
    } else {
      onChange([...columns, key])
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('export.columns.title', { defaultValue: 'Select export columns' }) as string}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-100">
            {t('export.columns.title', { defaultValue: 'Select export columns' })}{' '}
            <span className="text-gray-500 font-normal">({format.toUpperCase()})</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300"
            aria-label={t('common.close', { defaultValue: 'Close' }) as string}
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2">
          {PRESET_NAMES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className={`px-2.5 py-1 text-xs rounded-lg border capitalize transition-colors ${
                columns.length === COLUMN_PRESETS[preset].length &&
                columns.every((c, i) => c === COLUMN_PRESETS[preset][i])
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                  : 'border-gray-700 text-gray-300 hover:bg-gray-800'
              }`}
            >
              {t(`export.columns.preset.${preset}`, { defaultValue: preset })}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('export.columns.search', { defaultValue: 'Filter columns…' }) as string}
          className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />

        <div>
          <p className="text-xs text-gray-500 mb-1.5">{t('export.columns.available', { defaultValue: 'Available' })}</p>
          <div className="flex flex-wrap gap-1.5">
            {filtered.map((c) => (
              <label
                key={c.key}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-700 text-xs text-gray-300 cursor-pointer hover:bg-gray-800"
              >
                <input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggle(c.key)} className="accent-cyan-500" />
                {c.label}
              </label>
            ))}
            {filtered.length === 0 && <p className="text-xs text-gray-600">{t('export.columns.noMatches', { defaultValue: 'No matching columns' })}</p>}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">{t('export.columns.selectedOrder', { defaultValue: 'Selected (drag to reorder)' })}</p>
          <DraggableColumnList key={columns.join(',')} columns={columns} onChange={onChange} onRemove={toggle} />
        </div>

        <div className="pt-2 border-t border-gray-800">
          <p className="text-xs text-gray-500 mb-1">{t('export.columns.preview', { defaultValue: 'Preview' })}</p>
          <p className="text-xs font-mono text-gray-400 truncate">{columns.map((k) => LABELS[k]).join(', ')}</p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            {t('common.done', { defaultValue: 'Done' })}
          </button>
        </div>
      </div>
    </div>
  )
}
