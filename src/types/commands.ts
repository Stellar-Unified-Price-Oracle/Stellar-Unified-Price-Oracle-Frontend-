/**
 * Types shared by the command palette and the command registry.
 *
 * A {@link Command} is a single, activatable action. Commands are registered by
 * whichever feature owns the state they touch (navigation, filters, exports,
 * …) and rendered by `CommandPalette`; see `context/CommandRegistryContext`.
 */

/**
 * Stable grouping identifier for a command. The palette resolves the display
 * label from `commandPalette.categories.<id>` so grouping stays translatable and
 * new categories can be added without touching the palette UI.
 */
export type CommandCategory = 'navigation' | 'pricePairs' | 'filters' | 'alerts' | 'exports' | 'theme' | 'savedViews'

/** Display/sort order for groups when the query is empty. */
export const COMMAND_CATEGORY_ORDER: readonly CommandCategory[] = [
  'navigation',
  'pricePairs',
  'filters',
  'alerts',
  'exports',
  'theme',
  'savedViews',
]

export interface Command {
  /** Unique, stable identifier. Duplicate ids keep the first registered entry. */
  id: string
  /** Primary label shown in the palette and matched against the query. */
  label: string
  category: CommandCategory
  /** Secondary text (e.g. a route or description) shown on the trailing edge. */
  hint?: string
  /** Extra searchable terms that don't appear in the label. */
  keywords?: string[]
  /** Invoked when the command is activated. May be async; rejections are logged. */
  handler: () => void | Promise<void>
  /**
   * When `false` the command is still listed but cannot be activated (for
   * example an export that is rate limited). Defaults to enabled.
   */
  enabled?: boolean
  /** Explanation shown when the command is disabled. */
  disabledReason?: string
}
