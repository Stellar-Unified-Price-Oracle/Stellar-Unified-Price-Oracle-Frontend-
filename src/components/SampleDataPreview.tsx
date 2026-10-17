import { useId, useState } from 'react'
import { SAMPLE_DATA_LABEL, SAMPLE_QUOTES, formatSamplePrice } from '../utils/sampleData'

/**
 * Empty-state disclosure that previews what the dashboard shows once feeds
 * arrive (#817). Collapsed by default; the native button keeps it keyboard
 * reachable, and the table caption carries the "not live" label to screen
 * readers as well as sighted users.
 */
export function SampleDataPreview() {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded border text-sm"
      >
        {open ? 'Hide sample data' : 'Show sample data'}
      </button>

      {open && (
        <div id={panelId} className="w-full max-w-md overflow-x-auto">
          <table className="w-full text-sm text-start">
            <caption className="mb-2 text-xs text-amber-300 text-start">{SAMPLE_DATA_LABEL}</caption>
            <thead>
              <tr className="text-xs text-gray-400">
                <th scope="col" className="py-1 text-start font-medium">
                  Pair
                </th>
                <th scope="col" className="py-1 text-end font-medium">
                  Sample price
                </th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_QUOTES.map((quote) => (
                <tr key={quote.assetPair} className="border-t border-gray-800">
                  <th scope="row" className="py-1 text-start font-medium">
                    {quote.assetPair}
                  </th>
                  <td className="py-1 text-end tabular-nums">{formatSamplePrice(quote.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
