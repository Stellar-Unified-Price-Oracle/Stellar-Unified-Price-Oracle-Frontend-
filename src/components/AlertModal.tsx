import { useState, useEffect, useRef, useCallback } from 'react'
import type { Alert, AlertFormData } from '../types'

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: AlertFormData) => void
  onDelete?: () => void
  alert?: Alert | null
  currentPrice?: number
  defaultAssetPair?: string
}

type ValidationErrors = Partial<Record<keyof AlertFormData, string>>

function validate(form: AlertFormData): ValidationErrors {
  const errors: ValidationErrors = {}

  if (!form.assetPair.trim()) {
    errors.assetPair = 'Asset pair is required'
  }

  const upper = form.upperThreshold ? Number.parseFloat(form.upperThreshold) : null
  const lower = form.lowerThreshold ? Number.parseFloat(form.lowerThreshold) : null

  if (!upper && !lower) {
    errors.upperThreshold = 'At least one threshold is required'
    errors.lowerThreshold = 'At least one threshold is required'
    return errors
  }

  if (upper !== null) {
    if (Number.isNaN(upper) || upper <= 0) {
      errors.upperThreshold = 'Must be a positive number'
    } else if (lower !== null && !Number.isNaN(lower) && upper <= lower) {
      errors.upperThreshold = 'Must be greater than lower threshold'
    }
  }

  if (lower !== null) {
    if (Number.isNaN(lower) || lower <= 0) {
      errors.lowerThreshold = 'Must be a positive number'
    } else if (upper !== null && !Number.isNaN(upper) && lower >= upper) {
      errors.lowerThreshold = 'Must be less than upper threshold'
    }
  }

  return errors
}

export function AlertModal({ isOpen, onClose, onSave, onDelete, alert, currentPrice, defaultAssetPair }: AlertModalProps) {
  const [form, setForm] = useState<AlertFormData>({
    assetPair: '',
    upperThreshold: '',
    lowerThreshold: '',
    triggerOnce: false,
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      if (alert) {
        setForm({
          assetPair: alert.assetPair,
          upperThreshold: alert.upperThreshold !== null ? String(alert.upperThreshold) : '',
          lowerThreshold: alert.lowerThreshold !== null ? String(alert.lowerThreshold) : '',
          triggerOnce: alert.triggerOnce,
        })
      } else {
        setForm({ assetPair: defaultAssetPair ?? '', upperThreshold: '', lowerThreshold: '', triggerOnce: false })
      }
      setErrors({})

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
    },
    [onClose],
  )

  const setAndValidate = useCallback((field: keyof AlertFormData, value: string | boolean) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      return next
    })
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const validationErrors = validate(form)
      setErrors(validationErrors)
      if (Object.keys(validationErrors).length === 0) {
        onSave(form)
      }
    },
    [form, onSave],
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

  if (!isOpen) return null

  const fieldError = (field: keyof AlertFormData) => errors[field]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={alert ? 'Edit price alert' : 'Create price alert'}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl focus:outline-none"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {alert ? 'Edit Alert' : 'New Price Alert'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-800"
            aria-label="Close modal"
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="alert-asset-pair" className="block text-sm font-medium text-gray-400 mb-1.5">
              Asset Pair
            </label>
            <input
              id="alert-asset-pair"
              type="text"
              value={form.assetPair}
              onChange={(e) => setAndValidate('assetPair', e.target.value)}
              disabled={!!alert}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="e.g. BTC/USD"
            />
            {fieldError('assetPair') && (
              <p className="mt-1 text-sm text-red-400" role="alert">
                {fieldError('assetPair')}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="alert-upper" className="block text-sm font-medium text-gray-400 mb-1.5">
              Upper Threshold
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
                placeholder="Max price"
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
              Lower Threshold
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
                placeholder="Min price"
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

          <div className="mb-6">
            <label htmlFor="alert-trigger-once" className="flex items-center gap-3 cursor-pointer group">
              <input
                id="alert-trigger-once"
                type="checkbox"
                checked={form.triggerOnce}
                onChange={(e) => setAndValidate('triggerOnce', e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/50 focus:ring-offset-0 cursor-pointer"
              />
              <div>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  Trigger once
                </span>
                <p className="text-xs text-gray-500">Alert deactivates after being triggered</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3">
            {onDelete && alert && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2.5 text-sm font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl hover:bg-red-400/20 transition-colors"
              >
                Delete Alert
              </button>
            )}
            <div className="flex-1 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 text-sm font-medium text-white bg-cyan-600 rounded-xl hover:bg-cyan-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                {alert ? 'Save Changes' : 'Create Alert'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
