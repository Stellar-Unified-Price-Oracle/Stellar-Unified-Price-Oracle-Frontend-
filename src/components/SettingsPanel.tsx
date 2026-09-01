import { useState, useCallback, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { usePreferences } from '../preferences/PreferencesContext'
import {
  REFRESH_INTERVAL_OPTIONS,
  CHART_RANGE_OPTIONS,
  STALE_THRESHOLD_OPTIONS,
  CHART_TIMEZONE_OPTIONS,
  FORMAT_LOCALE_OPTIONS,
} from '../preferences/constants'
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, orderByRecentlyUsed, type SupportedLanguage } from '../i18n'
import { clearAllData, getLocalStorageSize, writeRaw, STORAGE_KEYS } from '../utils/storage'
import { loadSoundPreferences, saveSoundPreferences } from '../utils/soundPreferences'
import { playAlertSound, unlockAudioContext } from '../utils/alertSound'

interface SettingsPanelProps {
  onClose: () => void
}

function AccessibilityToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={label}
        />
        <div
          className={`w-10 h-5 rounded-full transition-colors duration-200 ${
            checked ? 'bg-cyan-500' : 'bg-gray-700'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </label>
  )
}

export function SettingsPanel({ onClose }: SettingsPanelProps): ReactElement {
  const { preferences, updatePreference, undo, redo, canUndo, canRedo, clearHistory } =
    usePreferences()
  const { t, i18n } = useTranslation()
  const [clearStatus, setClearStatus] = useState<'idle' | 'confirming' | 'clearing' | 'done'>('idle')
  const [soundPrefs, setSoundPrefs] = useState(loadSoundPreferences)

  const storageSize = getLocalStorageSize()

  const handleClearRequest = useCallback(() => {
    setClearStatus('confirming')
  }, [])

  const handleClearConfirm = useCallback(async () => {
    setClearStatus('clearing')
    await clearAllData()
    setClearStatus('done')
    // After clearing, reload so contexts re-initialise with defaults
    setTimeout(() => window.location.reload(), 1200)
  }, [])

  const handleClearCancel = useCallback(() => {
    setClearStatus('idle')
  }, [])

  const handleSoundEnabledChange = useCallback((enabled: boolean) => {
    setSoundPrefs((prev) => {
      const next = { ...prev, enabled }
      saveSoundPreferences(next)
      return next
    })
  }, [])

  const handleSoundVolumeChange = useCallback((volume: number) => {
    setSoundPrefs((prev) => {
      const next = { ...prev, volume }
      saveSoundPreferences(next)
      return next
    })
  }, [])

  const handleTestSound = useCallback(() => {
    // A click is itself a user gesture, so this reliably unlocks playback.
    unlockAudioContext()
    playAlertSound(soundPrefs.volume)
  }, [soundPrefs.volume])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} role="presentation" />
      <div className="relative w-full max-w-md bg-gray-900 border-l border-gray-800 h-full overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            aria-label={t('settings.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Language */}
          <section aria-labelledby="language-settings-heading">
            <h3 id="language-settings-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              {t('settings.sections.language')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.language.label')}
                </label>
                <select
                  value={i18n.language.split('-')[0]}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {LANGUAGE_LABELS[lang as SupportedLanguage]}
                    </option>
                  ))}
                </select>
              </div>
              <AccessibilityToggle
                label={t('settings.language.rtlOverride')}
                description={t('settings.language.rtlOverrideDesc')}
                checked={preferences.rtlEnabled}
                onChange={(val) => updatePreference('rtlEnabled', val)}
              />
            </div>
          </section>

          {/* Data preferences */}
          <section aria-labelledby="data-settings-heading">
            <h3 id="data-settings-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              {t('settings.sections.data')}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.fields.refreshInterval')}
                </label>
                <select
                  value={preferences.refreshInterval}
                  onChange={(e) => updatePreference('refreshInterval', Number(e.target.value) as typeof preferences.refreshInterval)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {REFRESH_INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.fields.chartTimeRange')}
                </label>
                <select
                  value={preferences.chartTimeRange}
                  onChange={(e) => updatePreference('chartTimeRange', e.target.value as typeof preferences.chartTimeRange)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {CHART_RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('settings.fields.staleThreshold')}
                </label>
                <select
                  value={preferences.staleThresholdMinutes}
                  onChange={(e) => updatePreference('staleThresholdMinutes', Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {STALE_THRESHOLD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Chart Timezone
                </label>
                <select
                  value={preferences.chartTimezone}
                  onChange={(e) =>
                    updatePreference(
                      'chartTimezone',
                      e.target.value as typeof preferences.chartTimezone,
                    )
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Chart timezone"
                >
                  {CHART_TIMEZONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Timezone used for X-axis labels on price charts.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Number & Date Format
                </label>
                <select
                  value={preferences.formatLocale}
                  onChange={(e) =>
                    updatePreference(
                      'formatLocale',
                      e.target.value as typeof preferences.formatLocale,
                    )
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  aria-label="Format locale for numbers and dates"
                >
                  {FORMAT_LOCALE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  How to format prices, numbers, and dates. "Auto" uses your language setting.
                </p>
              </div>
            </div>
          </section>

          {/* Accessibility presets */}
          <section aria-labelledby="a11y-settings-heading">
            <h3 id="a11y-settings-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              {t('settings.sections.accessibility')}
            </h3>
            <div className="space-y-4">
              <AccessibilityToggle
                label={t('settings.accessibility.reducedMotion')}
                description={t('settings.accessibility.reducedMotionDesc')}
                checked={preferences.reducedMotion}
                onChange={(val) => updatePreference('reducedMotion', val)}
              />
              <AccessibilityToggle
                label={t('settings.accessibility.highContrast')}
                description={t('settings.accessibility.highContrastDesc')}
                checked={preferences.highContrast}
                onChange={(val) => updatePreference('highContrast', val)}
              />
              <AccessibilityToggle
                label={t('settings.accessibility.largeText')}
                description={t('settings.accessibility.largeTextDesc')}
                checked={preferences.largeText}
                onChange={(val) => updatePreference('largeText', val)}
              />
            </div>
          </section>

          {/* Privacy / Analytics */}
          <section aria-labelledby="privacy-settings-heading">
            <h3 id="privacy-settings-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              {t('settings.sections.privacy')}
            </h3>
            <div className="space-y-4">
              <AccessibilityToggle
                label={t('settings.privacy.enableAnalytics')}
                description={t('settings.privacy.enableAnalyticsDesc')}
                checked={!preferences.analyticsOptOut}
                onChange={(val) => {
                  updatePreference('analyticsOptOut', !val)
                  writeRaw(STORAGE_KEYS.analyticsOptOut, !val ? '0' : '1')
                }}
              />
            </div>
          </section>

          {/* Alert sound (#308) */}
          <section aria-labelledby="sound-settings-heading">
            <h3 id="sound-settings-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Alert Sound
            </h3>
            <div className="space-y-4">
              <AccessibilityToggle
                label="Play sound on alert"
                description="Plays a short tone when a price alert fires. Requires interacting with the page first — browsers block audio until then."
                checked={soundPrefs.enabled}
                onChange={handleSoundEnabledChange}
              />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="alert-sound-volume" className="text-sm font-medium text-gray-300">
                    Volume
                  </label>
                  <span className="text-xs text-gray-500">{Math.round(soundPrefs.volume * 100)}%</span>
                </div>
                <input
                  id="alert-sound-volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={soundPrefs.volume}
                  disabled={!soundPrefs.enabled}
                  onChange={(e) => handleSoundVolumeChange(Number(e.target.value))}
                  className="w-full accent-cyan-500 disabled:opacity-40"
                  aria-label="Alert sound volume"
                />
              </div>

              <button
                type="button"
                onClick={handleTestSound}
                disabled={!soundPrefs.enabled}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Test sound
              </button>
            </div>
          </section>

          {/* Data & Privacy — clear local data */}
          <section aria-labelledby="clear-data-heading">
            <h3 id="clear-data-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Local data
            </h3>
            <div className="rounded-lg border border-gray-800 bg-gray-800/40 p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Storage used</span>
                <span className="font-mono text-gray-300">{storageSize.formatted}</span>
              </div>
              <p className="text-xs text-gray-500">
                Includes alert thresholds, notification config, theme preference, and cached
                price data. No passwords, API keys, or personal information are stored.
              </p>

              {clearStatus === 'idle' && (
                <button
                  type="button"
                  onClick={handleClearRequest}
                  className="w-full px-4 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
                  aria-label="Clear all local data stored by this app"
                >
                  Clear all local data
                </button>
              )}

              {clearStatus === 'confirming' && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-400">
                    This will delete all alerts, notification settings, preferences, and cached
                    prices. The page will reload. This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleClearConfirm}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
                      aria-label="Confirm — clear all local data"
                    >
                      Yes, clear everything
                    </button>
                    <button
                      type="button"
                      onClick={handleClearCancel}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {clearStatus === 'clearing' && (
                <p className="text-xs text-gray-400 animate-pulse">Clearing data…</p>
              )}

              {clearStatus === 'done' && (
                <p className="text-xs text-green-400">Data cleared. Reloading…</p>
              )}
            </div>
          </section>
        </div>

        <div className="border-t border-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={t('settings.actions.undoAriaLabel')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
              </svg>
              {t('settings.actions.undo')}
              <span className="text-xs text-gray-500 ml-1">{t('settings.actions.undoShortcut')}</span>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={t('settings.actions.redoAriaLabel')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
              </svg>
              {t('settings.actions.redo')}
              <span className="text-xs text-gray-500 ml-1">{t('settings.actions.redoShortcut')}</span>
            </button>
            <button
              onClick={clearHistory}
              className="ml-auto px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              aria-label={t('settings.actions.clearAriaLabel')}
            >
              {t('settings.actions.clear')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
