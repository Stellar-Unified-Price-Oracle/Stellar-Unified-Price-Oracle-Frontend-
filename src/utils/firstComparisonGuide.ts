import { readJson, writeJson, STORAGE_KEYS } from './storage'

/** Checkpoints a new user passes on the way to their first useful price comparison. */
export interface ComparisonGuideProgress {
  /** The user opened a pair's detail page. */
  viewedPair: boolean
  /** The user selected at least two pairs to compare. */
  comparedPairs: boolean
  /** The user dismissed the guide; it never shows again. */
  dismissed: boolean
}

export interface ComparisonGuideStep {
  id: keyof Pick<ComparisonGuideProgress, 'viewedPair' | 'comparedPairs'>
  title: string
  detail: string
  done: boolean
}

export const DEFAULT_COMPARISON_GUIDE: ComparisonGuideProgress = {
  viewedPair: false,
  comparedPairs: false,
  dismissed: false,
}

const isComparisonGuideProgress = (value: unknown): value is ComparisonGuideProgress =>
  typeof value === 'object' &&
  value !== null &&
  (['viewedPair', 'comparedPairs', 'dismissed'] as const).every(
    (key) => typeof (value as Record<string, unknown>)[key] === 'boolean',
  )

export function readComparisonGuide(): ComparisonGuideProgress {
  return readJson(STORAGE_KEYS.firstComparisonGuide, DEFAULT_COMPARISON_GUIDE, isComparisonGuideProgress)
}

export function saveComparisonGuide(progress: ComparisonGuideProgress): void {
  writeJson(STORAGE_KEYS.firstComparisonGuide, progress)
}

/** Ordered checklist for the guide, with each step's completion derived from progress. */
export function getComparisonGuideSteps(progress: ComparisonGuideProgress): ComparisonGuideStep[] {
  return [
    {
      id: 'viewedPair',
      title: 'Open a pair',
      detail: 'Select any price card to see each oracle source’s price for that pair.',
      done: progress.viewedPair,
    },
    {
      id: 'comparedPairs',
      title: 'Compare two pairs',
      detail: 'Turn on Select, then pick at least two pairs to compare them side by side.',
      done: progress.comparedPairs,
    },
  ]
}

/** The guide is finished once every checkpoint is done, so it can stop showing. */
export function isComparisonGuideComplete(progress: ComparisonGuideProgress): boolean {
  return progress.viewedPair && progress.comparedPairs
}
