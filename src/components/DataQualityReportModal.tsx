import { useState, useEffect, useRef, useId, useMemo, type FormEvent, type ReactElement } from 'react'
import {
  CODE_OF_CONDUCT_URL,
  createReport,
  loadReports,
  saveReports,
} from '../utils/moderation'
import { formatTimestamp } from '../utils/format'
import { findDuplicateReports } from '../utils/duplicateDetection'
import { DuplicateReportAlert } from './DuplicateReportAlert'

export type DataQualityConcernType =
  | 'price-spike'
  | 'stale-feed'
  | 'missing-data'
  | 'source-divergence'
  | 'incorrect-metadata'
  | 'other'

export const CONCERN_LABELS: Record<DataQualityConcernType, string> = {
  'price-spike': 'Abnormal price spike or sudden drop',
  'stale-feed': 'Stale or frozen price updates',
  'missing-data': 'Missing ticks or timeline gap',
  'source-divergence': 'Excessive divergence between oracle sources',
  'incorrect-metadata': 'Incorrect source timestamp or metadata',
  other: 'Other data-quality concern',
}

export interface DataQualityReportModalProps {
  isOpen: boolean
  onClose: () => void
  pair: string
  selectedTimestamp?: number | null
  selectedPrice?: number | null
  availableSources?: string[]
  onSuccess?: (reportId: string) => void
}

/**
 * Accessible modal dialog for users to report data-quality concerns
 * directly from an affected price chart (#859).
 */
export function DataQualityReportModal({
  isOpen,
  onClose,
  pair,
  selectedTimestamp,
  selectedPrice,
  availableSources = [],
  onSuccess,
}: DataQualityReportModalProps): ReactElement | null {
  const [concernType, setConcernType] = useState<DataQualityConcernType>('price-spike')
  const [suspectSource, setSuspectSource] = useState('all')
  const [evidence, setEvidence] = useState('')
  const [confidential, setConfidential] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [dismissedDuplicates, setDismissedDuplicates] = useState(false)

  const existingReports = useMemo(() => (isOpen ? loadReports() : []), [isOpen])
  const duplicates = useMemo(
    () =>
      findDuplicateReports(
        {
          surface: 'chart',
          targetId: pair,
          category: 'data-quality',
          evidence: `[Concern: ${CONCERN_LABELS[concernType]}] ${evidence}`,
        },
        existingReports,
      ),
    [pair, concernType, evidence, existingReports],
  )

  const titleId = useId()
  const descId = useId()
  const statusId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const firstInputRef = useRef<HTMLSelectElement>(null)

  // Track the element that triggered the modal to restore focus on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      // Focus first interactive control on mount
      setTimeout(() => {
        firstInputRef.current?.focus()
      }, 50)
    } else {
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus()
      }
      // Reset state on modal close
      setStatus('idle')
      setErrorMessage(null)
      setEvidence('')
      setConcernType('price-spike')
      setSuspectSource('all')
      setConfidential(false)
      setDismissedDuplicates(false)
    }
  }, [isOpen])

  // Trap focus and handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!evidence.trim()) {
      setStatus('error')
      setErrorMessage('Please describe the observed discrepancy before submitting.')
      return
    }

    setStatus('submitting')
    setErrorMessage(null)

    try {
      const formattedTimestamp =
        selectedTimestamp !== null && selectedTimestamp !== undefined
          ? `${formatTimestamp(selectedTimestamp)} (${selectedTimestamp})`
          : 'Feed-level observation (no specific timestamp)'

      const formattedPrice =
        selectedPrice !== null && selectedPrice !== undefined ? `$${selectedPrice}` : 'Unspecified'

      const evidencePayload = [
        `[Concern: ${CONCERN_LABELS[concernType]}]`,
        `Asset pair: ${pair}`,
        `Observed point: ${formattedTimestamp}`,
        `Observed price: ${formattedPrice}`,
        `Suspect source: ${suspectSource === 'all' ? 'All / Unspecified' : suspectSource}`,
        '--- Description ---',
        evidence.trim(),
      ].join('\n')

      const report = createReport({
        surface: 'chart',
        targetId: pair,
        category: 'data-quality',
        evidence: evidencePayload,
        confidential,
      })

      const existing = loadReports()
      const saved = saveReports([...existing, report])

      if (saved) {
        setStatus('success')
        onSuccess?.(report.id)
      } else {
        setStatus('error')
        setErrorMessage('Unable to save your report to local storage. Please verify browser permissions and try again.')
      }
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred while saving the report.')
    }
  }

  return (
    <div
      data-testid="data-quality-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl p-6 text-sm text-gray-900 dark:text-gray-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <span
              className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20"
              aria-hidden="true"
            >
              ⚠
            </span>
            <h2 id={titleId} className="text-base font-semibold">
              Report Data-Quality Concern
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <p id={descId} className="text-xs text-gray-500 dark:text-gray-400">
          Flag potential discrepancies or corrupted oracle points for <strong>{pair}</strong>. Reports enter our
          community triage queue and are reviewed according to the{' '}
          <a
            href={CODE_OF_CONDUCT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-600 dark:text-cyan-400 underline hover:no-underline"
          >
            Code of Conduct
          </a>
          . Your reporter identity is never recorded.
        </p>

        {/* Chart Context Card */}
        <div
          className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 p-3 flex flex-col gap-1 text-xs"
          role="region"
          aria-label="Reported chart context"
        >
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Asset Pair:</span>
            <span className="font-mono font-medium">{pair}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Affected Point:</span>
            <span className="font-mono">
              {selectedTimestamp !== null && selectedTimestamp !== undefined
                ? formatTimestamp(selectedTimestamp)
                : 'Whole chart / general feed'}
            </span>
          </div>
          {selectedPrice !== null && selectedPrice !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Reported Price:</span>
              <span className="font-mono text-cyan-600 dark:text-cyan-400">${selectedPrice}</span>
            </div>
          )}
        </div>

        {/* Live status announcements */}
        <div id={statusId} role="status" aria-live="polite" className="text-xs">
          {status === 'success' && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-green-700 dark:text-green-300 flex flex-col gap-2">
              <p className="font-medium">Thanks — your data-quality concern has been submitted for review!</p>
              <p className="text-[11px] text-green-600 dark:text-green-400">
                The incident has been added to the moderation triage queue. Our automated audit validators and
                community stewards will inspect the flagged ticks.
              </p>
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-rose-700 dark:text-rose-300">
              <p className="font-medium">{errorMessage}</p>
            </div>
          )}
        </div>

        {status !== 'success' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              Concern Classification
              <select
                ref={firstInputRef}
                value={concernType}
                onChange={(e) => setConcernType(e.target.value as DataQualityConcernType)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              >
                {Object.entries(CONCERN_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            {availableSources.length > 0 && (
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                Suspect Oracle Source (Optional)
                <select
                  value={suspectSource}
                  onChange={(e) => setSuspectSource(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">All contributors / Unsure</option>
                  {availableSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              <div className="flex justify-between items-center">
                <span>Observed Discrepancy &amp; Context</span>
                <span className="text-[11px] text-gray-400 tabular-nums">{evidence.length} / 2000</span>
              </div>
              <textarea
                required
                rows={4}
                maxLength={2000}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Describe what you observed (e.g. price deviated by >5% from spot markets, delayed updates, impossible spread)..."
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 resize-y"
              />
            </label>

            <DuplicateReportAlert
              duplicates={duplicates}
              dismissed={dismissedDuplicates}
              onDismiss={() => setDismissedDuplicates(true)}
            />

            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confidential}
                onChange={(e) => setConfidential(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-700 text-cyan-600 focus:ring-cyan-500"
              />
              Mark details as confidential (evidence restricted to verified stewards)
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'submitting' || !evidence.trim()}
                className="px-4 py-2 rounded-lg bg-amber-500 text-gray-950 font-medium hover:bg-amber-400 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {status === 'submitting' ? (
                  <>
                    <span className="inline-block w-3 h-3 border-2 border-gray-950 border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Concern'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
