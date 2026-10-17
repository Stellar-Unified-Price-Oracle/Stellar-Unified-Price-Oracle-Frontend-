import { useState } from 'react'
import { previewPairInversion } from '../utils/pairInversion'
import { formatPrice } from '../utils/format'

interface PairInversionPreviewProps {
  /** The pair currently displayed. */
  pair: string
  /** Current aggregated price for `pair`, or null/undefined when unavailable. */
  price: number | null | undefined
  /** Called with the inverted pair when the user confirms the switch. */
  onSwitch: (pair: string) => void
}

/**
 * Previews the base/quote inversion of the displayed pair before the user
 * switches to it (#810). The switch is offered only when the inverted pair is
 * tracked, and never while the inverted price is unavailable.
 */
export function PairInversionPreview({ pair, price, onSwitch }: PairInversionPreviewProps) {
  const [open, setOpen] = useState(false)
  const preview = previewPairInversion(pair, price)
  if (!preview) return null

  const panelId = `pair-inversion-${pair.replace(/[^A-Za-z0-9]/g, '-')}`
  const { from, to, invertedPrice, tracked } = preview

  return (
    <section aria-label="Invert pair" className="mb-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="px-3 py-1.5 text-sm rounded-lg border border-cyan-800 bg-cyan-900/20 text-cyan-300 hover:bg-cyan-900/40 transition-colors"
      >
        {open ? 'Hide inverted pair' : 'Preview inverted pair'}
      </button>

      {open && (
        <div id={panelId} className="mt-3 rounded-lg border border-gray-800 bg-gray-900 p-4 text-sm text-gray-300">
          <p>
            <span className="font-mono">{from}</span> inverts to <span className="font-mono">{to}</span>
          </p>
          <p role="status" className="mt-2">
            {invertedPrice === null
              ? `No current price for ${from}, so the inverted price is unavailable.`
              : `1 ${to} ≈ ${formatPrice(invertedPrice)}`}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            The inverted price is 1 divided by the current price. Confidence and source weights are not recalculated.
          </p>

          {tracked ? (
            <button
              type="button"
              disabled={invertedPrice === null}
              onClick={() => onSwitch(to)}
              className="mt-3 px-3 py-1.5 text-sm rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Switch to {to}
            </button>
          ) : (
            <p className="mt-3 text-xs text-amber-300">
              {to} is not tracked, so switching to it would show an unknown pair.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
