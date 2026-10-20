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
    securityLink: 'Security',
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

  metricHelp: {
    docsTitle: 'Understanding price metrics',
    helpFor: 'Help: {{topic}}',
    readDocs: 'Read the metric guide',
    topics: {
      confidence: {
        title: 'Confidence',
        description:
          'A score from 0 to 1 describing how strongly the available oracle sources agree. 0.95 is 95% confidence; it is not a probability that the price is correct.',
      },
      divergence: {
        title: 'Divergence',
        description:
          'The percentage difference between the off-chain aggregate and the latest on-chain oracle value. Larger differences can indicate delayed publication or a source disagreement.',
      },
      staleness: {
        title: 'Data freshness',
        description:
          'How long ago this price was reported. Older data may no longer reflect current market conditions; the configured freshness threshold marks when it is stale.',
      },
      weights: {
        title: 'Aggregation weights',
        description:
          'The share each active oracle source contributes to a weighted aggregate. Active weights add up to 100%; excluded sources contribute nothing.',
      },
    },
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
      invalidDate: 'Enter a valid date',
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
    // ── Price-level retest detection (#491) ──────────────────────────────
    retest: {
      title: 'Notify on retest',
      description: 'Also fire if the price re-enters this breached level after it exits.',
    },
    recovery: {
      title: 'Notify when condition clears',
      description: 'Send a recovery notice through the same enabled channels when this rule stops matching.',
    },
    // ── Alert simulation (#490) ──────────────────────────────────────────
    simulate: {
      title: 'Test alert',
      run: 'Run simulation',
      description:
        'Replays a synthetic price series through the same evaluation logic used live, marking exactly where this alert would fire.',
      idle: 'Run a simulation to see how this alert behaves without touching your live configuration.',
    },
    // ── Per-alert channel routing (#492) ──────────────────────────────────
    channels: {
      title: 'Notify via',
      description:
        'Choose where this alert is delivered. Leave empty to use the channels configured in your notification settings.',
      useGlobal: 'Use global defaults',
      noneConfigured: 'No channels configured — set up channels in Notification Settings first.',
      readiness: {
        title: 'Channel readiness',
        remoteNote: 'Checks verify local settings and browser permission only; remote delivery is not probed.',
        blocked: 'Resolve the channel readiness issues before saving.',
        ready: 'Ready locally',
        disabled: 'Channel is disabled in notification settings',
        missingConfiguration: 'Required channel settings are missing',
        missingSecret: 'Session-only secret is missing; re-enter it in notification settings',
        permissionRequired: 'Browser notification permission is not granted',
        permissionDenied: 'Browser notification permission was denied; change it in browser settings',
        unsupported: 'Browser notifications are unavailable in this environment',
      },
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
    delivery: {
      title: 'Delivery attempts',
      empty: 'No attempts recorded this session; earlier history is unavailable.',
      status_queued: 'Retrying',
      status_delivered: 'Accepted',
      status_failed: 'Failed',
      attemptCount: '{{count}} attempts',
      attemptDelivered: 'Attempt {{attempt}} accepted',
      attemptFailed: 'Attempt {{attempt}} failed: {{error}}',
      unknownError: 'Unknown error',
    },
    lifecycle: {
      title: 'Rule schedule',
      expired: 'Expired',
      expiresOn: 'Expires {{date}}',
      reviewDue: 'Review due',
      reviewOn: 'Review {{date}}',
    },
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
    // Alert health checks (#493)
    health: {
      badge: 'May never fire',
      review: 'Review',
      dismiss: 'Dismiss',
      title: 'Health check',
      reasonNeverSatisfiable: 'This threshold has never been reached in the observed history.',
      reasonInsufficientHistory: 'Not enough price history yet to judge this condition.',
      suggestion: 'Observed data suggests {{value}} instead.',
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
      archived: 'Archived',
    },
    bulk: {
      selectRules: 'Select rules ({{count}} selected)',
      selectAll: 'Select all',
      clearSelection: 'Clear selection',
      pause: 'Pause selected',
      archive: 'Archive selected',
      editDates: 'Bulk edit dates',
      applyExpiry: 'Change expiry date',
      applyReview: 'Change review reminder',
      expiryHelp: 'Choose a date, or leave blank to clear expiry. Expiry uses local end-of-day.',
      reviewHelp: 'Choose a date, or leave blank to clear the reminder.',
      saveDates: 'Apply date changes',
      cancel: 'Cancel',
      restore: 'Restore rule',
      archivedEmpty: 'No archived rules',
    },
    history: {
      empty: 'No alerts have fired yet',
      searchPlaceholder: 'Search by asset pair…',
      noResults: 'No history entries match your search',
      clear: 'Clear history',
      clearConfirm: 'Clear all alert history? This cannot be undone.',
      exportCsv: 'Export CSV',
      exportJson: 'Export JSON',
      sourceNote:
        'Stored only in this browser; at most 500 recent records are retained. Exports include the current search results. Times are UTC. This is not a server-verified audit log.',
      storageUnavailable:
        'Browser storage is unavailable. Only current-session entries can be shown; they may not persist.',
      storageError: 'Saved alert history could not be read, so the empty view does not confirm that no alerts fired.',
      retentionLimit: 'The 500-record retention limit is reached; older events may have been discarded.',
      exporting: 'Preparing alert history export…',
      exportComplete: 'Alert history export is ready.',
      exportFailed: 'Alert history export failed. Please try again.',
      count_one: '{{count}} fired alert',
      count_other: '{{count}} fired alerts',
      priceAt: 'Price: ${{price}}',
      tickEvidence: 'Show exact tick evidence',
      tickTime: 'Tick time',
      tickConfidence: 'Confidence',
      tickSources: 'Contributing sources',
      sourcePrices: 'Per-source tick prices',
      tickUnavailable: 'Not provided by the price feed',
      evaluationTimeline: 'Rule evaluation timeline ({{count}})',
      evaluationTimelineLabel: 'Recent rule evaluations',
      noEvaluations: 'No evaluation events yet. Waiting for a rule check.',
      conditionResult: '{{field}} {{operator}} {{expected}}; observed {{actual}} — {{result}}',
      matched: 'matched',
      notMatched: 'not matched',
      fields: {
        price: 'Price',
        percentageChange: 'Percentage change',
        schedule: 'Schedule',
      },
      evaluationReasons: {
        inactive: 'Rule is inactive',
        snoozed: 'Rule is snoozed',
        priceUnavailable: 'No current price tick was available',
        stalePrice: 'Price tick is stale; waiting for fresh data',
        baselineReset: 'Percentage baseline was initialized; this tick was not evaluated',
        cooldown: 'Condition matched; waiting for cooldown to expire',
        conditionNotMet: 'Conditions were not satisfied',
        conditionMatched: 'Conditions were satisfied',
        thresholdCleared: 'Threshold condition cleared',
        notAvailable: 'Unavailable',
      },
    },
    // ── Escalation progress (#487) ────────────────────────────────────────
    escalation: {
      label: 'Escalation:',
      progress: '{{fired}} of {{total}} steps fired',
      historyBadge: 'Escalation · {{channel}}',
    },
    // ── Price-level retest detection (#491) ───────────────────────────────
    retest: {
      inBreach: 'In breach',
      exited: 'Exited',
      idle: 'Monitoring',
      historyBadge: 'Retest',
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
      description:
        'Momentum confirmed across two windows: a strong 1-hour move still accelerating in the last 15 minutes.',
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
    installDetail: 'Keep live oracle prices one tap away, with the app shell available offline.',
    installAction: 'Install',
    installing: 'Opening…',
    installDismiss: 'Not now',
    installError: 'The install prompt could not be opened. You can install this app from your browser menu.',
    updateTitle: 'Update available',
    updateVersion: 'Version {{version}}',
    updateNotes: 'Includes the latest fixes and improvements.',
    updateAction: 'Reload to update',
    updating: 'Applying…',
    updateDismiss: 'Later',
    offlineReady: 'The app shell is cached for offline access. Live prices still need a connection.',
    errorTitle: 'Offline support or update is unavailable',
    errorDetail: 'The current app remains available online; the requested service worker change was not applied.',
    dismissError: 'Dismiss',
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
    historyStorageWarning:
      'Browser storage is nearing its limit. The browser may remove locally saved price history; live prices are unaffected.',
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
      downloadProof: 'Download proof (JSON)',
      downloadSuccess: 'Proof bundle downloaded',
      downloadError: 'Failed to download proof bundle',
      guideToggleShow: 'How to independently verify this proof',
      guideToggleHide: 'Hide independent verification guide',
      guideTitle: 'Independent Proof Verification Guide',
      guideDescription:
        'Exported proof payloads can be independently validated offline or via Soroban RPC without trusting this frontend.',
      cliCommandLabel: 'Soroban CLI query command',
      copyCliCommand: 'Copy CLI command',
      step1Title: '1. Verify On-Chain Transaction & Ledger Anchor',
      step1Detail:
        'Verify the transaction hash and ledger sequence on Stellar Horizon or Soroban RPC to ensure the aggregate state is finalized on-chain.',
      step2Title: '2. Query Soroban Contract Directly',
      step2Detail:
        'Run the Soroban CLI command to query the get_proof method directly against the deployed oracle contract.',
      step3Title: '3. Verify Ed25519 Cryptographic Signatures',
      step3Detail:
        'Verify the aggregate commitment and each individual source contribution signature against reported public keys.',
      step4Title: '4. Confirm Aggregation Consensus & Confidence',
      step4Detail:
        'Validate that the published aggregate price represents the deterministic median and confidence weighting of all contributing oracle sources.',
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
      chartHistoryPageSize: 'Chart History Points per Page',
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
    cacheStatus: 'Cache:',
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

  // ── Command palette ───────────────────────────────────────────────────────
  commandPalette: {
    title: 'Command palette',
    open: 'Open command palette',
    openShort: 'Search',
    placeholder: 'Type a command or search…',
    noResults: 'No commands match “{{query}}”',
    noResultsHint: 'Try a different search term.',
    resultCount_one: '{{count}} command',
    resultCount_other: '{{count}} commands',
    hintNavigate: 'Navigate',
    hintExecute: 'Execute',
    hintClose: 'Close',
    categories: {
      navigation: 'Navigation',
      pricePairs: 'Price Pairs',
      filters: 'Filters & Sort',
      alerts: 'Alerts',
      exports: 'Export',
      theme: 'Theme',
      savedViews: 'Saved Views',
    },
    nav: {
      webhooks: 'Webhooks',
      security: 'Security',
    },
    filters: {
      clear: 'Clear all filters',
      allSources: 'Show all oracle sources',
      sourceOnly: 'Show only {{source}}',
      updatedWithin: 'Updated within {{window}}',
      sortBy: 'Sort by {{field}}',
      toggleDirection: 'Toggle sort direction',
    },
    alerts: {
      create: 'Create a price alert…',
      togglePanel: 'Toggle alerts panel',
    },
    exports: {
      csv: 'Export as CSV',
      json: 'Export as JSON',
      xlsx: 'Export as XLSX',
      columns: 'Select export columns…',
      disabledNoData: 'No data to export',
      disabledRateLimited: 'Export rate limit reached ({{seconds}}s)',
    },
    theme: {
      light: 'Switch to light theme',
      dark: 'Switch to dark theme',
      system: 'Use system theme',
      toggle: 'Toggle light/dark theme',
    },
  },
} as const

export default en
