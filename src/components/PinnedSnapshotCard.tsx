import { memo } from 'react'
import type { PinnedPairSnapshot } from '../utils/pinnedPairs'
import { formatPrice, formatTimestamp, timeAgo } from '../utils/format'

interface PinnedSnapshotCardProps {
  snapshot: PinnedPairSnapshot
}

/**
 * Shows the last price saved for a pinned pair when the live price cannot be
 * loaded. It is always labelled as a snapshot, never as live data (#831).
 */
export const PinnedSnapshotCard = memo(function PinnedSnapshotCard({ snapshot }: PinnedSnapshotCardProps) {
  return (
    <section
      aria-label="Offline pinned price"
      className="p-4 bg-gray-900 border border-cyan-800/50 rounded-xl text-sm text-gray-200"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-cyan-300">Pinned snapshot · not live</p>
      <p className="mt-2 text-3xl font-bold font-mono text-gray-100">${formatPrice(snapshot.price)}</p>
      <p className="mt-2 text-xs text-gray-400">
        Price from {timeAgo(snapshot.timestamp)} ({formatTimestamp(snapshot.timestamp)}). Last saved{' '}
        {timeAgo(snapshot.savedAt)}.
      </p>
    </section>
  )
})
