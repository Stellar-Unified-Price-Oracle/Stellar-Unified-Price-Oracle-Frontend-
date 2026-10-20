import { useMemo, useState, type ReactElement } from 'react'
import { fetchRoadmapItems } from '../api/rest'
import { useSwr } from '../hooks/useSwr'
import { RoadmapCard } from '../components/RoadmapCard'
import {
  ROADMAP_CATEGORIES,
  ROADMAP_STATUSES,
  type RoadmapCategory,
  type RoadmapItem,
  type RoadmapStatus,
} from '../types/roadmap'

const CATEGORY_NAMES: Record<RoadmapCategory, string> = {
  protocol: 'Protocol',
  feeds: 'Feeds & DEX',
  governance: 'Governance',
  infrastructure: 'Infrastructure',
  security: 'Security & ZK',
}

const STATUS_NAMES: Record<RoadmapStatus, string> = {
  planned: 'Planned',
  in_development: 'In Development',
  testnet: 'Testnet Live',
  completed: 'Completed',
  deferred: 'Deferred',
}

export function Roadmap(): ReactElement {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<RoadmapCategory | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<RoadmapStatus | 'all'>('all')

  const {
    data: items,
    error,
    loading,
    refetch,
  } = useSwr<RoadmapItem[]>('roadmap/items', (signal) => fetchRoadmapItems(signal), {
    refreshInterval: 60_000,
    staleTime: 30_000,
    retryCount: 0,
  })

  const allItems = items ?? []

  // Count items by status for the summary badges
  const statusCounts = useMemo(() => {
    const counts: Record<RoadmapStatus, number> = {
      planned: 0,
      in_development: 0,
      testnet: 0,
      completed: 0,
      deferred: 0,
    }
    for (const item of allItems) {
      if (counts[item.status] !== undefined) {
        counts[item.status]++
      }
    }
    return counts
  }, [allItems])

  // Filtered items based on search query, category, and status
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allItems.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false
      if (!q) return true

      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.steward.toLowerCase().includes(q) ||
        item.targetMilestone.toLowerCase().includes(q) ||
        item.changeHistory.some(
          (c) =>
            c.reason.toLowerCase().includes(q) ||
            c.changedBy.toLowerCase().includes(q) ||
            c.fromStatus.toLowerCase().includes(q) ||
            c.toStatus.toLowerCase().includes(q),
        )
      )
    })
  }, [allItems, searchQuery, selectedCategory, selectedStatus])

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'all' || selectedStatus !== 'all'

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedStatus('all')
  }

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Protocol Roadmap & Public Change History
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-3xl">
              Transparent milestone tracking, working group ownership, and verifiable audit log of status
              transitions across the Stellar Unified Price Oracle ecosystem.
            </p>
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start md:self-auto px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
            aria-label="Refresh roadmap items"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Status Metrics Ribbon */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3" role="region" aria-label="Roadmap status summary">
          {ROADMAP_STATUSES.map((status) => {
            const count = statusCounts[status]
            const isSelected = selectedStatus === status
            return (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(isSelected ? 'all' : status)}
                className={`p-3 rounded-xl border text-start transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  isSelected
                    ? 'border-cyan-500 ring-1 ring-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
                aria-label={`Filter by status: ${STATUS_NAMES[status]}`}
                aria-pressed={isSelected}
              >
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {STATUS_NAMES[status]}
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
                  {loading ? '...' : count}
                </div>
              </button>
            )
          })}
        </div>
      </header>

      {/* Controls Bar */}
      <section
        aria-label="Filter and search roadmap"
        className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-6"
      >
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <label htmlFor="roadmap-search" className="sr-only">
              Search roadmap items, stewards, or changes
            </label>
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              id="roadmap-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items, milestones, stewards, or change notes..."
              className="w-full ps-9 pe-8 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Clear search query"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="category-filter" className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
              Category:
            </label>
            <select
              id="category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as RoadmapCategory | 'all')}
              className="py-2 px-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Categories</option>
              {ROADMAP_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_NAMES[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
              Status:
            </label>
            <select
              id="status-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as RoadmapStatus | 'all')}
              className="py-2 px-3 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">All Statuses</option>
              {ROADMAP_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_NAMES[status]}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="py-2 px-3 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg whitespace-nowrap transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Live counter region */}
        <div
          role="status"
          aria-live="polite"
          className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between"
        >
          <span>
            Showing <strong className="text-gray-800 dark:text-gray-200">{filteredItems.length}</strong> of{' '}
            <strong className="text-gray-800 dark:text-gray-200">{allItems.length}</strong> roadmap items
          </span>
          {hasActiveFilters && (
            <span className="italic text-[11px]">Filters active</span>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      {error ? (
        <div
          role="alert"
          className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center my-8 text-red-600 dark:text-red-400"
        >
          <p className="font-semibold text-base mb-2">Unable to load roadmap items</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">{String(error)}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Retry Connection
          </button>
        </div>
      ) : loading && allItems.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true" aria-label="Loading roadmap items">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800/40 animate-pulse border border-gray-200 dark:border-gray-800"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl my-8">
          <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No roadmap items matched your search.</p>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Try adjusting your search terms, status, or category filters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredItems.map((item) => (
            <RoadmapCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  )
}
export default Roadmap
