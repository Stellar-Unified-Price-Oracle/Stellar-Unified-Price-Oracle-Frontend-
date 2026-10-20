/**
 * @file DisputePanel (#695)
 *
 * Formal on-platform record for price disputes and challenges. Each dispute
 * shows the contested price, rationale, evidence, comments, and resolution
 * — replacing off-platform discussion and leaving an auditable trail.
 *
 * Rendering rules:
 * - Status is displayed verbatim (never inferred from the clock).
 * - A breached deadline is flagged as a caveat; the dispute is not
 *   auto-resolved client-side.
 * - resolutionNote renders verbatim — never truncated.
 */
import { memo, useState, type ReactElement } from 'react'
import type { PriceDispute, DisputeEvidence, DisputeComment } from '../types'
import {
  DISPUTE_STATUS_LABELS,
  DISPUTE_STATUS_STYLES,
  isDisputeResolved,
  isDeadlineBreached,
  orderDisputes,
  openDisputeCount,
  evidenceCountLabel,
  getDisputeStatusTransitions,
} from '../utils/disputeProcess'

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

interface EvidenceListProps {
  items: DisputeEvidence[]
}

const EvidenceList = memo(function EvidenceList({ items }: EvidenceListProps): ReactElement {
  if (items.length === 0) {
    return <p className="text-xs text-gray-500 italic">No evidence has been attached.</p>
  }
  return (
    <ul className="flex flex-col gap-2 list-none p-0">
      {items.map((ev) => (
        <li key={ev.id} className="flex flex-col gap-1 text-xs">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-gray-500">{formatTimestamp(ev.submittedAt)}</span>
            <span className="font-mono text-gray-400" title={ev.submittedBy}>
              {truncateAddress(ev.submittedBy)}
            </span>
          </div>
          <p className="text-gray-300">{ev.description}</p>
          {ev.uri !== null && (
            <span className="font-mono text-cyan-400 break-all">{ev.uri}</span>
          )}
        </li>
      ))}
    </ul>
  )
})

interface CommentListProps {
  items: DisputeComment[]
}

const CommentList = memo(function CommentList({ items }: CommentListProps): ReactElement {
  if (items.length === 0) {
    return <p className="text-xs text-gray-500 italic">No comments yet.</p>
  }
  return (
    <ul className="flex flex-col gap-3 list-none p-0">
      {items.map((c) => (
        <li key={c.id} className="border-l-2 border-gray-700 pl-3 flex flex-col gap-1">
          <div className="flex items-baseline gap-2 flex-wrap text-xs">
            <span className="font-mono text-gray-400" title={c.author}>
              {truncateAddress(c.author)}
            </span>
            <span className="text-gray-500">{formatTimestamp(c.postedAt)}</span>
          </div>
          <p className="text-sm text-gray-300">{c.body}</p>
        </li>
      ))}
    </ul>
  )
})

interface StatusTransitionTimelineProps {
  dispute: PriceDispute
}

const StatusTransitionTimeline = memo(function StatusTransitionTimeline({
  dispute,
}: StatusTransitionTimelineProps): ReactElement {
  const transitions = getDisputeStatusTransitions(dispute)

  return (
    <div className="flex flex-col gap-2.5 bg-gray-950/60 border border-gray-800/80 rounded-xl p-3.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Status Transition History
        </h4>
        <span className="text-[11px] text-gray-500">
          {transitions.length} recorded transition{transitions.length === 1 ? '' : 's'}
        </span>
      </div>

      <ol
        aria-label={`Status transitions for dispute ${dispute.id}`}
        className="relative border-l border-gray-700/80 ml-2 space-y-3.5 py-1 list-none p-0"
      >
        {transitions.map((t, idx) => {
          const isLatest = idx === transitions.length - 1
          const statusStyle = DISPUTE_STATUS_STYLES[t.status]
          const statusLabel = DISPUTE_STATUS_LABELS[t.status]
          const stepNumber = idx + 1

          return (
            <li
              key={`${t.status}-${t.timestamp}-${idx}`}
              className="ml-4 relative flex flex-col gap-1 text-xs"
              aria-current={isLatest ? 'step' : undefined}
            >
              <span
                className={`absolute -left-[23px] flex items-center justify-center w-4 h-4 rounded-full ring-2 ring-gray-900 text-[10px] ${
                  isLatest
                    ? 'bg-cyan-500 text-black font-bold ring-cyan-500/30'
                    : 'bg-gray-700 text-gray-300'
                }`}
                aria-hidden="true"
              >
                {stepNumber}
              </span>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${statusStyle}`}
                >
                  Stage: {statusLabel}
                </span>
                <span className="text-gray-400 tabular-nums">
                  {formatTimestamp(t.timestamp)}
                </span>
                {t.actor && (
                  <span className="text-gray-500 font-mono" title={t.actor}>
                    by {truncateAddress(t.actor)}
                  </span>
                )}
                {isLatest && !isDisputeResolved(dispute) && (
                  <span className="text-[10px] font-medium text-cyan-400 bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800/60">
                    Current Status
                  </span>
                )}
              </div>

              {t.note && <p className="text-gray-300 italic pl-0.5">{t.note}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
})

interface DisputeCardProps {
  dispute: PriceDispute
  now: number
}

const DisputeCard = memo(function DisputeCard({ dispute, now }: DisputeCardProps): ReactElement {
  const [expanded, setExpanded] = useState(false)
  const resolved = isDisputeResolved(dispute)
  const breached = isDeadlineBreached(dispute, now)
  const titleId = `dispute-${dispute.id}-title`

  return (
    <article
      aria-labelledby={titleId}
      className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 id={titleId} className="text-base font-semibold text-gray-100">
            {dispute.assetPair}{' '}
            <span className="text-gray-400 font-normal">— {dispute.contestedPrice}</span>
          </h3>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border whitespace-nowrap ${DISPUTE_STATUS_STYLES[dispute.status]}`}
          >
            {DISPUTE_STATUS_LABELS[dispute.status]}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span className="font-mono text-gray-500">{dispute.id}</span>
          <span>Opened {formatTimestamp(dispute.openedAt)}</span>
          {dispute.resolutionDeadline !== null && (
            <span className={breached ? 'text-yellow-400' : undefined}>
              {breached
                ? `Deadline breached ${formatTimestamp(dispute.resolutionDeadline)}`
                : `Deadline ${formatTimestamp(dispute.resolutionDeadline)}`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span>
            Challenger:{' '}
            <span className="font-mono text-gray-300" title={dispute.challenger}>
              {truncateAddress(dispute.challenger)}
            </span>
          </span>
          {dispute.challengerPrice !== null && (
            <span>
              Asserted price: <span className="font-mono text-gray-300">{dispute.challengerPrice}</span>
            </span>
          )}
        </div>
      </header>

      {/* Status Transition Timeline (#850) */}
      <StatusTransitionTimeline dispute={dispute} />

      {/* Rationale */}
      <p className="text-sm text-gray-300 leading-relaxed">{dispute.rationale}</p>

      {/* Implied sources */}
      {dispute.impliedSources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-500">Implicates:</span>
          {dispute.impliedSources.map((s) => (
            <span
              key={s}
              className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-yellow-500/10 text-yellow-300 border border-yellow-500/30"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Deadline breached caveat */}
      {breached && (
        <p
          role="note"
          className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2"
        >
          The resolution deadline has passed but this dispute has not yet been resolved. The status shown is as last
          reported — treat it as provisional.
        </p>
      )}

      {/* Resolution note */}
      {resolved && dispute.resolutionNote !== null && (
        <div className="bg-gray-800 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-400">Resolution note</span>
          <p className="text-sm text-gray-200">{dispute.resolutionNote}</p>
        </div>
      )}

      {/* Expandable evidence + comments */}
      <button
        type="button"
        aria-expanded={expanded}
        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors underline-offset-2 hover:underline self-start"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Hide details' : `Show details — ${evidenceCountLabel(dispute)}, ${dispute.comments.length} comment${dispute.comments.length === 1 ? '' : 's'}`}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Evidence</h4>
            <EvidenceList items={dispute.evidence} />
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Comments</h4>
            <CommentList items={dispute.comments} />
          </div>
        </div>
      )}
    </article>
  )
})

export interface DisputePanelProps {
  disputes: readonly PriceDispute[]
  /** Injected clock for deterministic rendering in tests. */
  now?: number
}

export const DisputePanel = memo(function DisputePanel({
  disputes,
  now = Date.now(),
}: DisputePanelProps): ReactElement {
  const ordered = orderDisputes(disputes)
  const nOpen = openDisputeCount(disputes)

  return (
    <section aria-labelledby="disputes-heading" className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 id="disputes-heading" className="text-lg font-semibold text-gray-100">
            Price disputes
          </h2>
          <p className="text-xs text-gray-400">
            Formal challenges to contested prices — with attached evidence, comments, and resolution notes. This is the
            on-platform record.
          </p>
        </div>
        {disputes.length > 0 && (
          <span className="text-xs text-gray-500 shrink-0">
            {nOpen > 0 ? (
              <span className="text-yellow-400 font-medium">{nOpen} open</span>
            ) : (
              'No open disputes'
            )}
            {' '}/ {disputes.length} total
          </span>
        )}
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No disputes have been recorded.</p>
      ) : (
        <ul className="flex flex-col gap-4 list-none p-0">
          {ordered.map((d) => (
            <li key={d.id}>
              <DisputeCard dispute={d} now={now} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
})
