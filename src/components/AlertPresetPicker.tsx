/**
 * @file AlertPresetPicker
 *
 * Preset library + custom preset management for `AlertModal` (#486). Shows the
 * built-in presets (`src/data/alertPresets.ts`) and the user's own saved presets
 * (`src/services/presetStorage.ts`) as one-click cards, plus a small form to save
 * the alert currently being configured as a new custom preset.
 */
import { useEffect, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { ALERT_PRESETS, type AlertPreset } from '../data/alertPresets'
import { presetStorage, type CustomAlertPreset } from '../services/presetStorage'

interface AlertPresetPickerProps {
  onSelectPreset: (preset: AlertPreset) => void
  onSelectCustom: (preset: CustomAlertPreset) => void
  /** Called when the user saves the form's current state as a new custom preset. */
  onSaveCurrent: (name: string, description: string) => Promise<void>
}

const ICONS: Record<AlertPreset['icon'], ReactElement> = {
  whale: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
    </svg>
  ),
  breakout: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  peg: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  custom: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
}

export function AlertPresetPicker({ onSelectPreset, onSelectCustom, onSaveCurrent }: AlertPresetPickerProps): ReactElement {
  const { t } = useTranslation()
  const [customPresets, setCustomPresets] = useState<CustomAlertPreset[]>([])
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const refreshCustomPresets = (): void => {
    presetStorage.list().then(setCustomPresets).catch(() => setCustomPresets([]))
  }

  useEffect(() => {
    refreshCustomPresets()
  }, [])

  const handleDeleteCustom = async (id: string): Promise<void> => {
    await presetStorage.remove(id)
    refreshCustomPresets()
  }

  const handleSave = async (): Promise<void> => {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      await onSaveCurrent(saveName.trim(), saveDescription.trim())
      setSaveName('')
      setSaveDescription('')
      setShowSaveForm(false)
      refreshCustomPresets()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-5">
      <span className="block text-sm font-medium text-gray-400 mb-2">{t('alertModal.presets.title')}</span>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
        {ALERT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset)}
            className="text-left p-3 bg-gray-800 border border-gray-700 rounded-xl hover:border-cyan-500/50 hover:bg-gray-800/80 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-cyan-400 mb-1">
              {ICONS[preset.icon]}
              <span className="text-sm font-semibold text-white">{t(preset.nameKey)}</span>
            </div>
            <p className="text-xs text-gray-400 mb-1">{t(preset.descriptionKey)}</p>
            <p className="text-[11px] text-gray-500 italic">{t(preset.useCaseKey)}</p>
          </button>
        ))}
      </div>

      {customPresets.length > 0 && (
        <div className="mb-2">
          <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            {t('alertModal.presets.myPresets')}
          </span>
          <ul className="space-y-1.5">
            {customPresets.map((preset) => (
              <li key={preset.id} className="flex items-center gap-2 p-2 bg-gray-800/50 border border-gray-700 rounded-lg">
                <button
                  type="button"
                  onClick={() => onSelectCustom(preset)}
                  className="flex-1 text-left text-sm text-gray-200 hover:text-cyan-400 transition-colors"
                >
                  {preset.name}
                  {preset.description && <span className="text-xs text-gray-500 ml-2">{preset.description}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteCustom(preset.id)}
                  aria-label={t('alertModal.presets.deleteCustom', { name: preset.name })}
                  className="text-gray-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-400/10 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showSaveForm ? (
        <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-xl space-y-2">
          <label htmlFor="preset-save-name" className="sr-only">
            {t('alertModal.presets.nameLabel')}
          </label>
          <input
            id="preset-save-name"
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={t('alertModal.presets.nameLabel')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
          <label htmlFor="preset-save-desc" className="sr-only">
            {t('alertModal.presets.descriptionLabel')}
          </label>
          <input
            id="preset-save-desc"
            type="text"
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            placeholder={t('alertModal.presets.descriptionLabel')}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!saveName.trim() || saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('alertModal.presets.save')}
            </button>
            <button
              type="button"
              onClick={() => setShowSaveForm(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 transition-colors"
            >
              {t('alertModal.actions.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowSaveForm(true)}
          className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          {t('alertModal.presets.saveCurrentAsPreset')}
        </button>
      )}
    </div>
  )
}
