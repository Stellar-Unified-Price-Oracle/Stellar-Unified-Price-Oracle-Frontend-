const en = {
  // ── Layout ──────────────────────────────────────────────────────────────
  nav: {
    home: 'Home',
    dashboard: 'Dashboard',
    apiDocs: 'API Docs',
    toggleMenu: 'Toggle menu',
    toggleAlerts: 'Toggle price alerts',
    appName: 'Stellar Oracle',
  },
  footer: {
    text: 'Stellar Unified Price Oracle · Developer Portal & Analytics Dashboard',
  },

  // ── Dashboard page ───────────────────────────────────────────────────────
  dashboard: {
    title: 'Price Oracle Dashboard',
    subtitle: 'Aggregated from Chainlink, Redstone, Band & Reflector',
    search: {
      placeholder: 'Search by asset pair...',
      ariaLabel: 'Search by asset pair',
    },
    filter: {
      toggle: 'Filter',
      ariaLabel: 'Toggle filter panel',
    },
    select: {
      button: 'Select',
      buttonWithCount: 'Select ({{count}})',
      buttonShort: 'Sel',
      ariaLabel: 'Toggle selection mode',
    },
    viewToggle: {
      ariaLabel: 'View toggle',
      card: 'Card view',
      table: 'Table view',
    },
    alerts: {
      ariaLabel: 'Configure notification channels',
      title: 'Alerts',
    },
    selection: {
      count: '{{count}} selected',
      selectAll: 'Select all',
      deselectAll: 'Deselect all',
      exportCsv: 'Export CSV',
    },
    emptyState: {
      noFeeds: 'No price feeds available',
      noFeedsDetail: 'Connect to the aggregator API to see price data.',
      noResults: 'No results',
      noResultsSearch: 'No results for "{{search}}"',
      noResultsFilterHint: 'Try adjusting your filters.',
      noResultsSearchHint: 'Try a different search term.',
    },
    loadingAriaLabel: 'Loading price cards',
    feedsAriaLabel: 'Price feeds',
    // ── Touch gestures / Pull-to-refresh (#293) ─────────────────────────
    pullToRefresh: {
      pull: 'Pull down to refresh',
      release: 'Release to refresh',
      refreshing: 'Refreshing…',
    },
    // ── Market overview stats row (#476) ────────────────────────────────
    overview: {
      ariaLabel: 'Market overview',
      tileAriaLabel: '{{label}}: {{value}}. Click to filter the grid.',
      change: {
        label: '24h Change',
        hint: 'avg across pairs',
        sessionHint: 'since tracking started',
      },
      high: {
        label: '24h High',
        hint: '{{count}} at high',
      },
      low: {
        label: '24h Low',
        hint: '{{count}} at low',
      },
      confidence: {
        label: 'Avg Confidence',
        hint: 'click for lowest',
      },
      freshness: {
        label: 'Avg Freshness',
        hint: 'click for stalest',
      },
    },
  },

  // ── FilterPanel ──────────────────────────────────────────────────────────
  filter: {
    title: 'Filters & Sort',
    clearAll: 'Clear all ({{count}})',
    sources: 'Oracle Sources',
    lastUpdated: 'Last Updated',
    confidence: 'Confidence: {{min}}%–{{max}}%',
    confidenceMin: 'Min',
    confidenceMax: 'Max',
    priceRange: 'Price Range',
    priceMin: 'Min',
    priceMax: 'Max',
    sortBy: 'Sort By',
    sortDefault: 'Default',
    sortDirection: {
      ascending: 'Ascending',
      descending: 'Descending',
      ariaLabel: 'Sort direction: {{direction}}',
    },
    updatedWithin: {
      all: 'Any time',
      '1h': '1 h',
      '6h': '6 h',
      '24h': '24 h',
      '7d': '7 d',
    },
    sort: {
      pair: 'Pair (A–Z)',
      priceHigh: 'Price (High → Low)',
      priceLow: 'Price (Low → High)',
      confidence: 'Confidence',
      recent: 'Last Updated',
    },
    ariaLabels: {
      minConfidence: 'Minimum confidence',
      maxConfidence: 'Maximum confidence',
      sortBy: 'Sort by',
      minPrice: 'Minimum price',
      maxPrice: 'Maximum price',
    },
  },

  // ── PriceCard ────────────────────────────────────────────────────────────
  priceCard: {
    updated: 'Updated {{time}}',
    confidence: '{{value}}% confidence',
    alertSet: 'Alert set',
    setAlert: 'Set alert',
    ariaLabel: 'View details for {{pair}}',
    alertAriaLabel: 'Set alert for {{pair}}',
    confidenceTooltip:
      'Confidence reflects how consistent the price is across oracle sources. 100% means all sources agree exactly.',
  },

  // ── PriceTableView ────────────────────────────────────────────────────────
  table: {
    ariaLabel: 'Price feeds table',
    columns: {
      pair: 'Pair',
      price: 'Price',
      confidence: 'Confidence',
      sources: 'Sources',
      updated: 'Updated',
      alert: 'Alert',
      select: 'Select',
    },
    row: {
      liveAriaLabel: 'Live data',
      alertAriaLabel: 'Active alert',
      rowAriaLabel: 'View details for {{pair}}',
      alertSet: 'Alert set',
      setAlert: 'Set alert',
      alertButtonAriaLabel: 'Set alert for {{pair}}',
    },
  },

  // ── AlertModal ────────────────────────────────────────────────────────────
  alertModal: {
    titleNew: 'New Price Alert',
    titleEdit: 'Edit Alert',
    ariaLabelNew: 'Create price alert',
    ariaLabelEdit: 'Edit price alert',
    close: 'Close modal',
    firedOnceNotice: 'This alert fired on {{time}} ({{count}} total). Re-enable it to use again.',
    fireCount: 'Fired {{count}} time(s)',
    fields: {
      assetPair: 'Asset Pair',
      assetPairPlaceholder: 'e.g. BTC/USD',
      upperThreshold: 'Upper Threshold',
      upperPlaceholder: 'Max price',
      lowerThreshold: 'Lower Threshold',
      lowerPlaceholder: 'Min price',
      triggerOnce: 'Trigger once',
      triggerOnceDescription: 'Alert deactivates after being triggered',
      // Alert mode (#307)
      alertMode: 'Alert Mode',
      alertModeAbsolute: 'Absolute Price',
      alertModePercentage: 'Price Movement %',
      // Percentage fields (#307)
      percentageThreshold: 'Change Threshold',
      percentageWindow: 'Time Window',
      percentageDirection: 'Direction',
      percentageRelativeTo: 'Relative To',
      window5min: '5 minutes',
      window15min: '15 minutes',
      window1hr: '1 hour',
      window24hr: '24 hours',
      directionUp: '↑ Up',
      directionDown: '↓ Down',
      directionEither: '↕ Either',
      relativeToOpen: 'Period Open',
      relativeToPreviousClose: 'Previous Close',
      relativeToMovingAverage: 'Moving Average',
      // Alert type (#312)
      alertType: 'Alert Type',
      alertTypeOneTime: 'One-Time',
      alertTypePersistent: 'Persistent',
      alertTypeOneTimeDesc: 'Fires once and auto-disables. Re-enable to reuse.',
      alertTypePersistentDesc: 'Fires every time the condition is met. Tracks fire count.',
      // Cooldown (#310)
      cooldown: 'Cooldown between alerts',
      cooldownOff: 'Off (fire immediately)',
      cooldown1min: '1 minute',
      cooldown5min: '5 minutes',
      cooldown15min: '15 minutes',
      cooldown1hr: '1 hour',
      cooldownDesc:
        'Minimum time between re-fires, to avoid notification spam when the price oscillates around your threshold.',
    },
    actions: {
      delete: 'Delete Alert',
      cancel: 'Cancel',
      save: 'Save Changes',
      create: 'Create Alert',
      reEnable: 'Re-enable Alert',
    },
    validation: {
      assetPairRequired: 'Asset pair is required',
      atLeastOneThreshold: 'At least one threshold is required',
      mustBePositive: 'Must be a positive number',
      upperGreaterThanLower: 'Must be greater than lower threshold',
      lowerLessThanUpper: 'Must be less than upper threshold',
    },
    // ── Compound AND/OR condition builder (#485) ──────────────────────────
    conditions: {
      title: 'Additional Conditions',
      description: 'Layer extra conditions on top of the field above, combined with AND/OR.',
      add: '+ Add condition',
      logicLabel: 'Combine conditions with',
      and: 'AND',
      or: 'OR',
      operatorLabel: 'Operator for condition {{index}}',
      valueLabel: 'Value for condition {{index}}',
      windowLabel: 'Time window for condition {{index}}',
      remove: 'Remove condition {{index}}',
      priceUnit: 'USD',
      operator_gt: '>',
      operator_gte: '≥',
      operator_lt: '<',
      operator_lte: '≤',
      operator_eq: '=',
    },
    // ── Escalation policy builder (#487) ──────────────────────────────────
    escalation: {
      enable: 'Enable escalation policy',
      description: 'Notify additional channels at increasing delays while the breach stays active.',
      addStep: '+ Add step',
      channelLabel: 'Channel for step {{step}}',
      delayLabel: 'Delay in minutes for step {{step}}',
      removeStep: 'Remove step {{step}}',
      minutesSuffix: 'min',
      channel_inApp: 'In-App',
      channel_email: 'Email',
      channel_webPush: 'Web Push',
      channel_webhook: 'Webhook',
      channel_telegram: 'Telegram',
      channel_discord: 'Discord',
      error_invalidDelay: 'Step {{step}}: delay must be a non-negative number of minutes',
      error_outOfOrder: 'Step {{step}}: delay must not be earlier than the previous step',
    },
    // ── Preset library (#486) ──────────────────────────────────────────────
    presets: {
      title: 'Start from a preset',
      myPresets: 'My Presets',
      deleteCustom: 'Delete preset {{name}}',
      nameLabel: 'Preset name',
      descriptionLabel: 'Description (optional)',
      save: 'Save Preset',
      saveCurrentAsPreset: '+ Save current settings as a preset',
    },
  },

  // ── AlertPanel ────────────────────────────────────────────────────────────
  alertPanel: {
    title: 'Price Alerts',
    newBadge: '{{count}} New',
    empty: 'No alerts set yet',
    close: 'Close alert panel',
    sections: {
      triggered: 'Triggered',
      active: 'Active Alerts',
      inactive: 'Inactive',
      snoozed: 'Snoozed',
      firedOnce: 'Fired (One-Time)',
    },
    triggered: {
      justNow: 'Just now',
      priceCrossed: 'Price crossed',
      markRead: 'Mark Read',
      delete: 'Delete',
    },
    active: {
      pause: 'Pause alert',
      delete: 'Delete alert',
    },
    inactive: {
      resume: 'Resume alert',
      delete: 'Delete alert',
    },
    // Snooze (#313)
    snooze: {
      button: 'Snooze',
      unsnooze: 'Remove snooze',
      '15min': '15 minutes',
      '1hr': '1 hour',
      '4hr': '4 hours',
      '24hr': '24 hours',
      tomorrow: 'Until tomorrow (8 AM)',
      expiresInMins: 'Snoozed for {{mins}}m',
      expiresInHrs: 'Snoozed for {{hrs}}h',
    },
    // Alert type badges (#312)
    badge: {
      oneTime: 'One-Time',
      persistent: 'Persistent',
      snoozed: 'Snoozed',
      fired: 'Fired',
    },
    // Fired one-time (#312)
    fired: {
      at: 'Fired at {{time}}',
      reEnable: 'Re-enable alert',
    },
    conditions: {
      between: 'Between ${{lower}} and ${{upper}}',
      above: '↑ Above ${{upper}}',
      below: '↓ Below ${{lower}}',
      none: 'No threshold',
      // Percentage condition (#307)
      percentage: '{{direction}} {{pct}}% in {{window}}',
      dir_up: '↑ Up',
      dir_down: '↓ Down',
      dir_either: '↕ Either',
    },
    // History log tabs (#309)
    tabs: {
      alerts: 'Alerts',
      history: 'History',
    },
    history: {
      empty: 'No alerts have fired yet',
      searchPlaceholder: 'Search by asset pair…',
      noResults: 'No history entries match your search',
      clear: 'Clear history',
      clearConfirm: 'Clear all alert history? This cannot be undone.',
      exportCsv: 'Export CSV',
      exportJson: 'Export JSON',
      count_one: '{{count}} fired alert',
      count_other: '{{count}} fired alerts',
      priceAt: 'Price: ${{price}}',
    },
    // ── Escalation progress (#487) ────────────────────────────────────────
    escalation: {
      label: 'Escalation:',
      progress: '{{fired}} of {{total}} steps fired',
      historyBadge: 'Escalation · {{channel}}',
    },
  },

  // ── Alert preset library (#486) ─────────────────────────────────────────
  alertPresets: {
    whaleMove: {
      name: 'Whale Move',
      description: 'A large price swing in either direction over a short window.',
      useCase: 'Catch sudden moves from a large holder before the broader market reacts.',
    },
    breakout: {
      name: 'Breakout',
      description: 'Momentum confirmed across two windows: a strong 1-hour move still accelerating in the last 15 minutes.',
      useCase: 'Spot a move that is more than noise — the trend is confirmed, not just starting.',
    },
    pegBreak: {
      name: 'Stablecoin Peg Break',
      description: 'Price drifts more than 1% away from its $1.00 peg in either direction.',
      useCase: 'Get an early warning if a stablecoin you hold or rely on is losing its peg.',
    },
  },

  // ── ConnectionBadge ───────────────────────────────────────────────────────
  connection: {
    live: 'Live',
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    offline: 'Offline',
    rateLimited: 'Rate limited',
    rateLimitedWithTimer: 'Rate limited ({{seconds}}s)',
    ariaLabel: 'WebSocket {{status}}',
    rateLimitedAriaLabel: 'API rate limited',
    tooltips: {
      connected: 'WebSocket is connected. Price updates are streaming in real time.',
      connecting: 'Establishing a WebSocket connection to the price feed server.',
      reconnecting: 'The WebSocket connection was lost. Attempting to reconnect automatically.',
      disconnected: 'WebSocket is offline. Prices are updated via REST polling only.',
      rateLimited: 'The API is temporarily rate limited. Requests will resume after the retry window expires.',
    },
  },

  // ── ErrorBoundary ─────────────────────────────────────────────────────────
  error: {
    title: 'Something went wrong',
    defaultMessage: 'An unexpected error occurred.',
    reload: 'Reload page',
  },

  // ── NetworkStatusBanner ───────────────────────────────────────────────────
  network: {
    offline: 'No internet connection',
    offlineDetail: 'Data may be stale until you reconnect',
  },

  // ── PWA install / update prompts (#361) ───────────────────────────────────
  pwa: {
    installTitle: 'Install Stellar Oracle',
    installDetail: 'Add this app to your device for quick access and offline support.',
    installAction: 'Install',
    installDismiss: 'Not now',
    updateTitle: 'Update available',
    updateDetail: 'A new version of the app is ready.',
    updateAction: 'Reload',
    updateDismiss: 'Later',
  },

  // ── NotFound page ─────────────────────────────────────────────────────────
  notFound: {
    heading: '404',
    message: 'Page not found',
    backToDashboard: 'Back to Dashboard',
  },

  // ── PriceDetail page ──────────────────────────────────────────────────────
  priceDetail: {
    back: 'Back',
    backAriaLabel: 'Go back to dashboard',
    sections: {
      currentPrice: 'Current Price',
      oracleSources: 'Oracle Sources',
      priceHistory: 'Price History (Paginated)',
      importData: 'Import Price Data',
    },
    live: 'LIVE',
    confidence: '{{value}}% confidence',
    updated: 'Updated {{time}}',
    historyError: 'Failed to load price history: {{message}}',
    emptyState: {
      title: 'No price data available',
      detail: 'No price data available for this pair.',
    },
    tabs: {
      overview: 'Overview',
      proof: 'Proof',
    },
    proof: {
      loadingLabel: 'Loading on-chain proof',
      historicalSelectorLabel: 'Verify record',
      latestOption: 'Latest',
      unsupported: {
        title: 'On-chain proof unavailable',
        detail:
          'This asset pair has no canonical on-chain Stellar representation yet, so there is no Soroban oracle record to verify. See the on-chain oracle roadmap for what it takes to bring a feed on-chain.',
      },
      error: 'Failed to load on-chain proof: {{message}}',
      retry: 'Retry',
      aggregateSection: 'Aggregate Commitment',
      aggregateSignature: 'Aggregate signature',
      contractId: 'Contract',
      transaction: 'Transaction',
      ledger: 'Ledger #{{sequence}}',
      viewOnExplorer: 'View on explorer',
      contributionsSection: 'Source Contributions',
      contributionsCount: '{{count}} sources contributed to this record',
      copy: 'Copy',
      copyProofPayload: 'Copy proof payload',
      copied: 'Copied to clipboard',
      copyFailed: 'Failed to copy to clipboard',
    },
  },

  // ── CsvImportZone ─────────────────────────────────────────────────────────
  csv: {
    imported: 'CSV data imported — shown as overlay on chart',
    clear: 'Clear',
    dropOrBrowse: 'Drop a CSV file or',
    browse: 'browse',
    hint: 'Columns: timestamp, price — max 5 MB',
    uploadAriaLabel: 'Upload CSV file for price data import',
    errors: {
      tooLarge: 'File exceeds 5MB limit',
      invalidType: 'Only CSV files are supported',
      empty: 'File is empty',
      noValidRows: 'No valid rows found. Expected columns: timestamp, price',
    },
  },

  // ── ExportButton ──────────────────────────────────────────────────────────
  export: {
    button: 'Export',
    ariaLabel: 'Export data',
    exportAs: 'Export as {{format}}',
    langSelector: 'Code snippet language',
    columns: {
      button: 'Columns',
      title: 'Select export columns',
      preset: {
        minimal: 'Minimal',
        standard: 'Standard',
        full: 'Full',
      },
      search: 'Filter columns…',
      available: 'Available',
      noMatches: 'No matching columns',
      selectedOrder: 'Selected (drag to reorder)',
      preview: 'Preview',
    },
  },

  // ── SettingsPanel ─────────────────────────────────────────────────────────
  settings: {
    title: 'Settings',
    close: 'Close settings',
    sections: {
      data: 'Data',
      accessibility: 'Accessibility',
      privacy: 'Privacy',
      language: 'Language',
    },
    fields: {
      refreshInterval: 'Refresh Interval',
      chartTimeRange: 'Chart Time Range',
      staleThreshold: 'Stale Asset Threshold',
    },
    accessibility: {
      reducedMotion: 'Reduced Motion',
      reducedMotionDesc: 'Disables animations and transitions for motion-sensitive users',
      highContrast: 'High Contrast',
      highContrastDesc: 'Increases color contrast ratios for low-vision users',
      largeText: 'Large Text',
      largeTextDesc: 'Increases base font size across the dashboard',
    },
    privacy: {
      enableAnalytics: 'Enable Analytics',
      enableAnalyticsDesc: 'Allow privacy-focused analytics for feature usage (can be opted out).',
    },
    language: {
      label: 'Interface Language',
      rtlOverride: 'Force RTL Layout',
      rtlOverrideDesc: 'Override direction to RTL for testing without switching language',
    },
    actions: {
      undo: 'Undo',
      undoShortcut: 'Ctrl+Z',
      undoAriaLabel: 'Undo last change',
      redo: 'Redo',
      redoShortcut: 'Ctrl+Shift+Z',
      redoAriaLabel: 'Redo last undone change',
      clear: 'Clear',
      clearAriaLabel: 'Clear undo history',
    },
  },

  // ── ApiDocs page ──────────────────────────────────────────────────────────
  apiDocs: {
    title: 'API Documentation',
    subtitle: 'REST and WebSocket endpoints exposed by the Stellar Unified Price Oracle Aggregator.',
    openSpec: 'Open OpenAPI Spec',
    baseUrl: 'Base URL:',
    ws: 'WS:',
    tryItOut: 'Try it out',
    sending: 'Sending…',
    copy: 'Copy',
    copied: 'Copied!',
  },

  // ── Source descriptions (PriceCard tooltips) ──────────────────────────────
  sources: {
    chainlink:
      'Chainlink is a decentralised oracle network that delivers tamper-proof price data from premium data providers.',
    redstone:
      'RedStone is a modular oracle that streams signed price feeds on demand, reducing gas costs by storing data off-chain.',
    band: 'Band Protocol aggregates real-world data from multiple sources and makes it available on-chain via delegated validators.',
    reflector: 'Reflector is a Stellar-native oracle that publishes asset prices directly on the Stellar network.',
    defaultTooltip: '{{source}} contributed a price feed to this aggregated value.',
  },

  // ── Landing / Hero (#297) ─────────────────────────────────────────────────
  landing: {
    hero: {
      ariaLabel: 'Market overview hero section',
      liveStatus: 'Live · All oracles active',
      title: 'Stellar Unified Price Oracle',
      subtitle:
        'Aggregated, real-time asset prices from Chainlink, Redstone, Band, and Reflector — streamed directly to your app via REST & WebSocket.',
      cta: 'Open Dashboard',
      ctaAriaLabel: 'Open the price oracle dashboard',
      apiDocs: 'API Docs',
    },
    stats: {
      totalPairs: 'Tracked Pairs',
      totalPairsDetail: 'asset pairs monitored',
      activeSources: 'Oracle Sources',
      activeSourcesDetail: 'active data providers',
      avgConfidence: 'Avg Confidence',
      avgConfidenceDetail: 'across all pairs',
      highConfidence: 'High Confidence',
      highConfidenceDetail: 'pairs above 90%',
    },
    topPairs: {
      title: 'Top Pairs by Confidence',
      pairAriaLabel: 'View price details for {{pair}}',
      sources: 'sources',
      confidence: 'conf.',
    },
    powered: {
      label: 'Powered by',
    },
  },

  // ── Drag-and-drop reordering (#294) ───────────────────────────────────────
  draggableGrid: {
    dragHint: 'Drag to reorder',
    ariaLabel: 'Drag to reorder price cards',
    dropTarget: 'Drop here',
  },

  // ── Touch gestures / Pull-to-refresh (#293) ───────────────────────────────

  // ── Wallet connection (Freighter) ─────────────────────────────────────────
  wallet: {
    connect: 'Connect Wallet',
    connecting: 'Connecting…',
    disconnect: 'Disconnect',
    installFreighter: 'Install Freighter',
    network: 'Network',
    address: 'Address',
    balance: 'Balance',
    balanceUnfunded: 'Not funded',
    ariaConnected: 'Wallet connected: {{address}}',
    gate: {
      title: 'Wallet required',
      description:
        'Connect a Stellar wallet to use on-chain features like deploying and publishing to the oracle contract.',
    },
  },
} as const

export default en
