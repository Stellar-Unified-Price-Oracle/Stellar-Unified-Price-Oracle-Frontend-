/**
 * PrivacyDashboard
 *
 * Displays:
 *  - Remaining epsilon budget per category (visual progress bars)
 *  - Plain-language privacy guarantee explanation
 *  - Opt-out / opt-in control (takes effect immediately)
 *  - Count of events recorded today
 *
 * Written at 8th-grade reading level per issue #118 acceptance criteria.
 * No dark patterns: privacy settings are clearly labeled.
 */

import { type ReactElement } from 'react'
import { usePrivacyAnalytics } from '../../hooks/usePrivacyAnalytics'
import { DEFAULT_CONFIG } from '../budget/BudgetManager'
import type { EventCategory } from '../types'

const CATEGORY_LABELS: Record<EventCategory, string> = {
  navigation: 'Page navigation',
  price_view: 'Price pair views',
  alert_interaction: 'Alert interactions',
  export: 'Data exports',
  search: 'Search queries',
}

const CATEGORY_DESCRIPTIONS: Record<EventCategory, string> = {
  navigation: 'Which pages you visit',
  price_view: 'Which price pairs you look at',
  alert_interaction: 'When you create or dismiss alerts',
  export: 'When you export data',
  search: 'What you search for',
}

function BudgetBar({ category, spent, total }: { category: EventCategory; spent: number; total: number }): ReactElement {
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0
  const remaining = Math.max(0, total - spent)
  const remainingPct = total > 0 ? Math.min(100, (remaining / total) * 100) : 100

  return (
    <li className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline text-sm">
        <span className="font-medium text-gray-200">{CATEGORY_LABELS[category]}</span>
        <span className="text-xs text-gray-400">
          {remainingPct.toFixed(0)}% privacy budget left
        </span>
      </div>
      <p className="text-xs text-gray-500">{CATEGORY_DESCRIPTIONS[category]}</p>
      <div
        className="h-1.5 rounded-full bg-gray-700 overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${CATEGORY_LABELS[category]} privacy budget used`}
      >
        <div
          className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-400' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  )
}

export function PrivacyDashboard(): ReactElement {
  const { budgetState, optOut, optIn } = usePrivacyAnalytics()

  const categories = Object.keys(DEFAULT_CONFIG.epsilonPerCategory) as EventCategory[]

  const totalEventsToday = Object.values(budgetState.spentPerCategory).reduce(
    (sum, spent) => sum + Math.round(spent / 0.1),
    0,
  )

  return (
    <section
      className="rounded-xl bg-gray-900 border border-gray-700 p-5 space-y-5 max-w-lg"
      aria-labelledby="privacy-dashboard-heading"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="privacy-dashboard-heading" className="text-base font-semibold text-white">
            Privacy Settings
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            We use math (differential privacy) to collect usage statistics without ever learning
            what you personally do.
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
            budgetState.optedOut
              ? 'bg-gray-700 text-gray-300'
              : 'bg-green-900 text-green-300'
          }`}
        >
          {budgetState.optedOut ? 'Opted out' : 'Active'}
        </span>
      </div>

      {/* Plain-language guarantee */}
      <div className="rounded-lg bg-blue-950/50 border border-blue-800/50 p-3 text-xs text-blue-200 space-y-1">
        <p>
          <strong>What is differential privacy?</strong> Before any usage data leaves your browser,
          we add random noise to it. This means even if someone could see all the data we collect,
          they still could not tell what <em>you</em> specifically did.
        </p>
        <p>
          Privacy strength: <strong>ε = {DEFAULT_CONFIG.dailyEpsilon.toFixed(1)}</strong> (lower is
          stronger; 1.0 is considered strong). Budget resets every 24 hours.
        </p>
      </div>

      {/* Budget meters */}
      {!budgetState.optedOut && (
        <div>
          <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">
            Today's data collection
          </p>
          <ul className="space-y-3">
            {categories.map((cat) => (
              <BudgetBar
                key={cat}
                category={cat}
                spent={budgetState.spentPerCategory[cat] ?? 0}
                total={DEFAULT_CONFIG.epsilonPerCategory[cat]}
              />
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            Approximate contributions today:{' '}
            <strong className="text-gray-300">{totalEventsToday}</strong>
          </p>
        </div>
      )}

      {/* Opt-out / opt-in */}
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-gray-800">
        <p className="text-xs text-gray-400">
          {budgetState.optedOut
            ? 'You have opted out. No data is collected.'
            : 'You can stop all data collection at any time.'}
        </p>
        {budgetState.optedOut ? (
          <button
            type="button"
            onClick={optIn}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md bg-blue-700 hover:bg-blue-600 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Opt back in
          </button>
        ) : (
          <button
            type="button"
            onClick={optOut}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Opt out
          </button>
        )}
      </div>
    </section>
  )
}
