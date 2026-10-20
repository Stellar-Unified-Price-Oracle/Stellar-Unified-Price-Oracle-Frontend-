import { useState, useId, type ReactElement } from 'react'
import type { RoadmapItem, RoadmapStatus } from '../types/roadmap'

const STATUS_CONFIG: Record<
  RoadmapStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  planned: {
    label: 'Planned',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-300',
    dotClass: 'bg-sky-400',
  },
  in_development: {
    label: 'In Development',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300',
    dotClass: 'bg-amber-400',
  },
  testnet: {
    label: 'Testnet Live',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-300',
    dotClass: 'bg-purple-400',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300',
    dotClass: 'bg-emerald-400',
  },
  deferred: {
    label: 'Deferred',
    badgeClass: 'bg-gray-500/15 text-gray-400 border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-300',
    dotClass: 'bg-gray-400',
  },
}

const CATEGORY_LABELS: Record<string, string> = {
  protocol: 'Protocol',
  feeds: 'Feeds & DEX',
  governance: 'Governance',
  infrastructure: 'Infrastructure',
  security: 'Security & ZK',
}

function formatStatus(status: string): string {
  if (status === 'initial') return 'Initial Draft'
  return STATUS_CONFIG[status as RoadmapStatus]?.label ?? status
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ts))
}

export interface RoadmapCardProps {
  item: RoadmapItem
  defaultExpanded?: boolean
}

export function RoadmapCard({ item, defaultExpanded = false }: RoadmapCardProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const historyId = useId()
  const titleId = useId()

  const statusMeta = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.planned

  return (
    <article
      aria-labelledby={titleId}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between"
    >
      <div>
        {/* Top badges: Category, Milestone & Current Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              {CATEGORY_LABELS[item.category] ?? item.category}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/50">
              {item.targetMilestone}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusMeta.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} aria-hidden="true" />
            {statusMeta.label}
          </span>
        </div>

        {/* Item Title & Description */}
        <h3 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white leading-snug mb-2">
          {item.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
          {item.description}
        </p>

        {/* Metadata info */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400 pb-4 border-b border-gray-100 dark:border-gray-800/80">
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Steward: </span>
            <span>{item.steward}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700 dark:text-gray-300">Updated: </span>
            <time dateTime={new Date(item.lastUpdated).toISOString()}>{formatDate(item.lastUpdated)}</time>
          </div>
        </div>
      </div>

      {/* Change History Accordion */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls={historyId}
          aria-label={`Toggle public change history for ${item.title}`}
          className="w-full flex items-center justify-between text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 rounded py-1 px-1.5 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-cyan-500 dark:text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Public Change History ({item.changeHistory.length})
          </span>
          <svg
            className={`w-4 h-4 transform transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : 'rotate-0'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div
            id={historyId}
            className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80 animate-in fade-in duration-150"
          >
            {item.changeHistory.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-1">No recorded status changes.</p>
            ) : (
              <ol className="relative border-s border-gray-200 dark:border-gray-700 ms-3 space-y-4 my-1">
                {item.changeHistory.map((change) => {
                  const toMeta = STATUS_CONFIG[change.toStatus] ?? STATUS_CONFIG.planned
                  return (
                    <li key={change.id} className="ms-4">
                      {/* Timeline marker */}
                      <span
                        className={`absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${toMeta.dotClass}`}
                        aria-hidden="true"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                        <div className="flex items-center gap-1 font-semibold text-gray-800 dark:text-gray-200">
                          <span className="text-gray-500 dark:text-gray-400 font-normal">
                            {formatStatus(change.fromStatus)}
                          </span>
                          <span aria-hidden="true" className="text-gray-400">
                            →
                          </span>
                          <span className={toMeta.badgeClass.split(' ')[1]}>{formatStatus(change.toStatus)}</span>
                        </div>
                        <time
                          dateTime={new Date(change.changedAt).toISOString()}
                          className="text-gray-500 dark:text-gray-400"
                        >
                          {formatDate(change.changedAt)}
                        </time>
                      </div>

                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 leading-normal">
                        {change.reason}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span>Changed by: {change.changedBy}</span>
                        {change.evidenceUrl && (
                          <a
                            href={change.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View evidence for ${change.reason}`}
                            className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:underline focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded"
                          >
                            <span>Evidence</span>
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </a>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
