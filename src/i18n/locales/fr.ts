const fr = {
  nav: {
    home: 'Accueil',
    dashboard: 'Tableau de bord',
    apiDocs: 'Documentation API',
    toggleMenu: 'Basculer le menu',
    toggleAlerts: 'Basculer les alertes de prix',
    appName: 'Stellar Oracle',
  },
  footer: {
    text: 'Stellar Unified Price Oracle · Portail développeur & Tableau de bord analytique',
    securityLink: 'Sécurité',
  },

  dashboard: {
    title: 'Tableau de bord Oracle des Prix',
    subtitle: 'Agrégé depuis Chainlink, Redstone, Band & Reflector',
    search: {
      placeholder: "Rechercher une paire d'actifs...",
      ariaLabel: "Rechercher une paire d'actifs",
    },
    filter: {
      toggle: 'Filtrer',
      ariaLabel: 'Basculer le panneau de filtres',
    },
    select: {
      button: 'Sélectionner',
      buttonWithCount: 'Sélectionner ({{count}})',
      buttonShort: 'Sel',
      ariaLabel: 'Basculer le mode de sélection',
    },
    viewToggle: {
      ariaLabel: 'Basculer la vue',
      card: 'Vue cartes',
      table: 'Vue tableau',
    },
    alerts: {
      ariaLabel: 'Configurer les canaux de notification',
      title: 'Alertes',
    },
    selection: {
      count: '{{count}} sélectionné(s)',
      selectAll: 'Tout sélectionner',
      deselectAll: 'Tout désélectionner',
      exportCsv: 'Exporter CSV',
    },
    emptyState: {
      noFeeds: 'Aucun flux de prix disponible',
      noFeedsDetail: "Connectez-vous à l'API de l'agrégateur pour voir les données.",
      noResults: 'Aucun résultat',
      noResultsSearch: 'Aucun résultat pour "{{search}}"',
      noResultsFilterHint: "Essayez d'ajuster vos filtres.",
      noResultsSearchHint: 'Essayez un terme de recherche différent.',
    },
    loadingAriaLabel: 'Chargement des cartes de prix',
    feedsAriaLabel: 'Flux de prix',
    // ── Touch gestures / Pull-to-refresh (#293) ─────────────────────────
    pullToRefresh: {
      pull: 'Tirer vers le bas pour actualiser',
      release: 'Relâcher pour actualiser',
      refreshing: 'Actualisation…',
    },
  },

  filter: {
    title: 'Filtres & Trier',
    clearAll: 'Tout effacer ({{count}})',
    sources: 'Sources Oracle',
    lastUpdated: 'Dernière mise à jour',
    confidence: 'Confiance : {{min}}%–{{max}}%',
    confidenceMin: 'Min',
    confidenceMax: 'Max',
    priceRange: 'Plage de prix',
    priceMin: 'Min',
    priceMax: 'Max',
    sortBy: 'Trier par',
    sortDefault: 'Par défaut',
    sortDirection: {
      ascending: 'Croissant',
      descending: 'Décroissant',
      ariaLabel: 'Sens de tri : {{direction}}',
    },
    updatedWithin: {
      all: "N'importe quand",
      '1h': '1 h',
      '6h': '6 h',
      '24h': '24 h',
      '7d': '7 j',
    },
    sort: {
      pair: 'Paire (A–Z)',
      priceHigh: 'Prix (Élevé → Bas)',
      priceLow: 'Prix (Bas → Élevé)',
      confidence: 'Confiance',
      recent: 'Dernière mise à jour',
    },
    ariaLabels: {
      minConfidence: 'Confiance minimale',
      maxConfidence: 'Confiance maximale',
      sortBy: 'Trier par',
      minPrice: 'Prix minimum',
      maxPrice: 'Prix maximum',
    },
  },

  priceCard: {
    updated: 'Mis à jour {{time}}',
    confidence: '{{value}}% confiance',
    alertSet: 'Alerte active',
    setAlert: 'Créer une alerte',
    ariaLabel: 'Voir les détails de {{pair}}',
    alertAriaLabel: 'Créer une alerte pour {{pair}}',
    confidenceTooltip:
      'La confiance reflète la cohérence du prix entre les sources oracle. 100% signifie que toutes les sources concordent exactement.',
  },

  table: {
    ariaLabel: 'Tableau des flux de prix',
    columns: {
      pair: 'Paire',
      price: 'Prix',
      confidence: 'Confiance',
      sources: 'Sources',
      updated: 'Mis à jour',
      alert: 'Alerte',
      select: 'Sélectionner',
    },
    row: {
      liveAriaLabel: 'Données en direct',
      alertAriaLabel: 'Alerte active',
      rowAriaLabel: 'Voir les détails de {{pair}}',
      alertSet: 'Alerte active',
      setAlert: 'Créer une alerte',
      alertButtonAriaLabel: 'Créer une alerte pour {{pair}}',
    },
  },

  alertModal: {
    titleNew: 'Nouvelle alerte de prix',
    titleEdit: "Modifier l'alerte",
    ariaLabelNew: 'Créer une alerte de prix',
    ariaLabelEdit: 'Modifier une alerte de prix',
    close: 'Fermer la fenêtre',
    firedOnceNotice: 'Cette alerte a été déclenchée le {{time}} ({{count}} au total). Réactivez-la pour la réutiliser.',
    fireCount: 'Déclenchée {{count}} fois',
    fields: {
      assetPair: "Paire d'actifs",
      assetPairPlaceholder: 'ex. BTC/USD',
      upperThreshold: 'Seuil supérieur',
      upperPlaceholder: 'Prix maximum',
      lowerThreshold: 'Seuil inférieur',
      lowerPlaceholder: 'Prix minimum',
      triggerOnce: 'Déclencher une fois',
      triggerOnceDescription: "L'alerte se désactive après avoir été déclenchée",
      alertMode: "Mode d'alerte",
      alertModeAbsolute: 'Prix absolu',
      alertModePercentage: '% Mouvement de prix',
      percentageThreshold: 'Seuil de variation',
      percentageWindow: 'Fenêtre temporelle',
      percentageDirection: 'Direction',
      percentageRelativeTo: 'Par rapport à',
      window5min: '5 minutes',
      window15min: '15 minutes',
      window1hr: '1 heure',
      window24hr: '24 heures',
      directionUp: '↑ Hausse',
      directionDown: '↓ Baisse',
      directionEither: '↕ Les deux',
      relativeToOpen: 'Ouverture de période',
      relativeToPreviousClose: 'Clôture précédente',
      relativeToMovingAverage: 'Moyenne mobile',
      alertType: "Type d'alerte",
      alertTypeOneTime: 'Unique',
      alertTypePersistent: 'Persistante',
      alertTypeOneTimeDesc: 'Se déclenche une fois et se désactive. Réactivez pour réutiliser.',
      alertTypePersistentDesc: 'Se déclenche à chaque fois que la condition est remplie.',
      // Cooldown (#310)
      cooldown: 'Délai entre alertes',
      cooldownOff: 'Désactivé (déclenchement immédiat)',
      cooldown1min: '1 minute',
      cooldown5min: '5 minutes',
      cooldown15min: '15 minutes',
      cooldown1hr: '1 heure',
      cooldownDesc:
        'Temps minimum entre deux déclenchements, pour éviter les notifications répétées lorsque le prix oscille autour de votre seuil.',
    },
    actions: {
      delete: "Supprimer l'alerte",
      cancel: 'Annuler',
      save: 'Enregistrer',
      create: "Créer l'alerte",
      reEnable: "Réactiver l'alerte",
    },
    validation: {
      assetPairRequired: "La paire d'actifs est requise",
      atLeastOneThreshold: 'Au moins un seuil est requis',
      mustBePositive: 'Doit être un nombre positif',
      upperGreaterThanLower: 'Doit être supérieur au seuil inférieur',
      lowerLessThanUpper: 'Doit être inférieur au seuil supérieur',
    },
    conditions: {
      title: 'Conditions supplémentaires',
      description: 'Ajoutez des conditions supplémentaires au champ ci-dessus, combinées avec AND/OR.',
      add: '+ Ajouter une condition',
      logicLabel: 'Combiner les conditions avec',
      and: 'ET',
      or: 'OU',
      operatorLabel: 'Opérateur de la condition {{index}}',
      valueLabel: 'Valeur de la condition {{index}}',
      windowLabel: 'Fenêtre temporelle de la condition {{index}}',
      remove: 'Supprimer la condition {{index}}',
      priceUnit: 'USD',
      operator_gt: '>',
      operator_gte: '≥',
      operator_lt: '<',
      operator_lte: '≤',
      operator_eq: '=',
    },
    escalation: {
      enable: "Activer la politique d'escalade",
      description: 'Notifie des canaux supplémentaires à des délais croissants tant que la violation reste active.',
      addStep: '+ Ajouter une étape',
      channelLabel: "Canal de l'étape {{step}}",
      delayLabel: "Délai en minutes de l'étape {{step}}",
      removeStep: "Supprimer l'étape {{step}}",
      minutesSuffix: 'min',
      channel_inApp: "Dans l'application",
      channel_email: 'E-mail',
      channel_webPush: 'Web Push',
      channel_webhook: 'Webhook',
      channel_telegram: 'Telegram',
      channel_discord: 'Discord',
      error_invalidDelay: 'Étape {{step}} : le délai doit être un nombre de minutes non négatif',
      error_outOfOrder: "Étape {{step}} : le délai ne peut pas être antérieur à celui de l'étape précédente",
    },
    // ── Price-level retest detection (#491) ──────────────────────────────
    retest: {
      title: 'Notifier en cas de re-test',
      description: 'Se déclenche aussi si le prix revient dans ce niveau franchi après en être sorti.',
    },
    // ── Alert simulation (#490) ──────────────────────────────────────────
    simulate: {
      title: "Tester l'alerte",
      run: 'Lancer la simulation',
      description:
        "Rejoue une série de prix synthétique dans la même logique d'évaluation qu'en direct, en marquant exactement où cette alerte se déclencherait.",
      idle: 'Lancez une simulation pour voir comment cette alerte se comporte sans toucher à votre configuration en direct.',
    },
    // ── Per-alert channel routing (#492) ──────────────────────────────────
    channels: {
      title: 'Notifier via',
      description:
        'Choisissez où cette alerte est livrée. Laissez vide pour utiliser les canaux configurés dans vos paramètres de notification.',
      useGlobal: 'Utiliser les valeurs par défaut globales',
      noneConfigured: "Aucun canal configuré — configurez d'abord les canaux dans les paramètres de notification.",
    },
    presets: {
      title: "Partir d'un modèle",
      myPresets: 'Mes modèles',
      deleteCustom: 'Supprimer le modèle {{name}}',
      nameLabel: 'Nom du modèle',
      descriptionLabel: 'Description (optionnelle)',
      save: 'Enregistrer le modèle',
      saveCurrentAsPreset: '+ Enregistrer les réglages actuels comme modèle',
    },
  },

  alertPanel: {
    title: 'Alertes de prix',
    newBadge: '{{count}} Nouvelle(s)',
    empty: 'Aucune alerte configurée',
    close: "Fermer le panneau d'alertes",
    sections: {
      triggered: 'Déclenchées',
      active: 'Alertes actives',
      inactive: 'Inactives',
      snoozed: 'En pause',
      firedOnce: 'Déclenchées (Unique)',
    },
    triggered: {
      justNow: "À l'instant",
      priceCrossed: 'Le prix a franchi',
      markRead: 'Marquer comme lu',
      delete: 'Supprimer',
    },
    active: {
      pause: 'Mettre en pause',
      delete: "Supprimer l'alerte",
    },
    inactive: {
      resume: 'Reprendre',
      delete: "Supprimer l'alerte",
    },
    snooze: {
      button: 'Mettre en veille',
      unsnooze: 'Désactiver la veille',
      '15min': '15 minutes',
      '1hr': '1 heure',
      '4hr': '4 heures',
      '24hr': '24 heures',
      tomorrow: "Jusqu'à demain (8h)",
      expiresInMins: 'En veille {{mins}} min',
      expiresInHrs: 'En veille {{hrs}} h',
    },
    badge: {
      oneTime: 'Unique',
      persistent: 'Persistante',
      snoozed: 'En veille',
      fired: 'Déclenchée',
    },
    // Alert health checks (#493)
    health: {
      badge: 'Peut ne jamais se déclencher',
      review: 'Vérifier',
      dismiss: 'Ignorer',
      title: 'Contrôle de santé',
      reasonNeverSatisfiable: "Ce seuil n'a jamais été atteint dans l'historique observé.",
      reasonInsufficientHistory: "Pas encore assez d'historique de prix pour juger cette condition.",
      suggestion: 'Les données observées suggèrent {{value}} à la place.',
    },
    fired: {
      at: 'Déclenchée le {{time}}',
      reEnable: "Réactiver l'alerte",
    },
    conditions: {
      between: 'Entre ${{lower}} et ${{upper}}',
      above: '↑ Au-dessus de ${{upper}}',
      below: '↓ En dessous de ${{lower}}',
      none: 'Aucun seuil',
      percentage: '{{direction}} {{pct}}% sur {{window}}',
      dir_up: '↑ Hausse',
      dir_down: '↓ Baisse',
      dir_either: '↕ Les deux',
    },
    tabs: {
      alerts: 'Alertes',
      history: 'Historique',
    },
    history: {
      empty: "Aucune alerte ne s'est encore déclenchée",
      searchPlaceholder: "Rechercher par paire d'actifs…",
      noResults: 'Aucune entrée ne correspond à votre recherche',
      clear: "Effacer l'historique",
      clearConfirm: "Effacer tout l'historique des alertes ? Cette action est irréversible.",
      exportCsv: 'Exporter en CSV',
      exportJson: 'Exporter en JSON',
      count_one: '{{count}} alerte déclenchée',
      count_other: '{{count}} alertes déclenchées',
      priceAt: 'Prix : ${{price}}',
    },
    escalation: {
      label: 'Escalade :',
      progress: '{{fired}} étape(s) sur {{total}} déclenchée(s)',
      historyBadge: 'Escalade · {{channel}}',
    },
    // ── Price-level retest detection (#491) ───────────────────────────────
    retest: {
      inBreach: 'Dans le niveau',
      exited: 'Hors du niveau',
      idle: 'Surveillance',
      historyBadge: 'Re-test',
    },
  },

  alertPresets: {
    whaleMove: {
      name: 'Mouvement de baleine',
      description: "Un fort mouvement de prix dans une direction ou l'autre sur une courte période.",
      useCase: "Repérez les mouvements soudains d'un gros détenteur avant que le marché ne réagisse.",
    },
    breakout: {
      name: 'Cassure',
      description:
        'Élan confirmé sur deux fenêtres : un fort mouvement sur 1 heure qui accélère encore sur les 15 dernières minutes.',
      useCase: 'Repérez un mouvement qui dépasse le simple bruit : la tendance est confirmée, pas seulement amorcée.',
    },
    pegBreak: {
      name: 'Rupture de parité stablecoin',
      description: "Le prix s'écarte de plus de 1 % de sa parité à 1,00 $ dans une direction ou l'autre.",
      useCase: 'Soyez alerté tôt si un stablecoin que vous détenez perd sa parité.',
    },
  },

  // ── ConnectionStatus ──────────────────────────────────────────────────────
  connection: {
    live: 'En direct',
    connecting: 'Connexion',
    reconnecting: 'Reconnexion',
    offline: 'Hors ligne',
    rateLimited: 'Limite atteinte',
    rateLimitedWithTimer: 'Limite atteinte ({{seconds}}s)',
    ariaLabel: 'WebSocket {{status}}',
    rateLimitedAriaLabel: 'API limitée',
    tooltips: {
      connected: 'Le WebSocket est connecté. Les mises à jour de prix sont diffusées en temps réel.',
      connecting: "Établissement d'une connexion WebSocket au serveur de flux de prix.",
      reconnecting: 'La connexion WebSocket a été perdue. Tentative de reconnexion automatique.',
      disconnected: 'Le WebSocket est hors ligne. Les prix sont mis à jour uniquement par interrogation REST.',
      rateLimited:
        "L'API est temporairement limitée. Les requêtes reprendront après expiration du délai de nouvelle tentative.",
    },
  },

  error: {
    title: "Une erreur s'est produite",
    defaultMessage: "Une erreur inattendue s'est produite.",
    reload: 'Recharger la page',
  },

  network: {
    offline: 'Pas de connexion internet',
    offlineDetail: "Les données peuvent être obsolètes jusqu'à la reconnexion",
  },

  pwa: {
    installTitle: 'Installer Stellar Oracle',
    installDetail: 'Ajoutez cette application à votre appareil pour un accès rapide et une utilisation hors ligne.',
    installAction: 'Installer',
    installDismiss: 'Pas maintenant',
    updateTitle: 'Mise à jour disponible',
    updateDetail: "Une nouvelle version de l'application est prête.",
    updateAction: 'Recharger',
    updateDismiss: 'Plus tard',
  },

  notFound: {
    heading: '404',
    message: 'Page introuvable',
    backToDashboard: 'Retour au tableau de bord',
  },

  priceDetail: {
    back: 'Retour',
    backAriaLabel: 'Revenir au tableau de bord',
    sections: {
      currentPrice: 'Prix actuel',
      oracleSources: 'Sources Oracle',
      priceHistory: 'Historique des prix (paginé)',
      importData: 'Importer des données de prix',
    },
    live: 'EN DIRECT',
    confidence: '{{value}}% de confiance',
    updated: 'Mis à jour {{time}}',
    historyError: "Échec du chargement de l'historique des prix : {{message}}",
    emptyState: {
      title: 'Aucune donnée de prix disponible',
      detail: 'Aucune donnée de prix disponible pour cette paire.',
    },
    tabs: {
      overview: 'Aperçu',
      proof: 'Preuve',
    },
    proof: {
      loadingLabel: 'Chargement de la preuve en chaîne',
      historicalSelectorLabel: "Vérifier l'enregistrement",
      latestOption: 'La plus récente',
      unsupported: {
        title: 'Preuve en chaîne indisponible',
        detail:
          "Cette paire d'actifs n'a pas encore de représentation Stellar canonique en chaîne, donc aucun enregistrement d'oracle Soroban à vérifier. Consultez la feuille de route de l'oracle en chaîne pour savoir ce qu'il faut pour amener un flux en chaîne.",
      },
      error: 'Échec du chargement de la preuve en chaîne : {{message}}',
      retry: 'Réessayer',
      aggregateSection: 'Engagement agrégé',
      aggregateSignature: 'Signature agrégée',
      contractId: 'Contrat',
      transaction: 'Transaction',
      ledger: 'Ledger #{{sequence}}',
      viewOnExplorer: "Voir dans l'explorateur",
      contributionsSection: 'Contributions des sources',
      contributionsCount: '{{count}} sources ont contribué à cet enregistrement',
      copy: 'Copier',
      copyProofPayload: 'Copier la charge utile de preuve',
      copied: 'Copié dans le presse-papiers',
      copyFailed: 'Échec de la copie dans le presse-papiers',
    },
  },

  csv: {
    imported: 'Données CSV importées — affichées en superposition sur le graphique',
    clear: 'Effacer',
    dropOrBrowse: 'Déposez un fichier CSV ou',
    browse: 'parcourir',
    hint: 'Colonnes : timestamp, price — 5 Mo max',
    uploadAriaLabel: 'Importer un fichier CSV pour les données de prix',
    errors: {
      tooLarge: 'Le fichier dépasse la limite de 5 Mo',
      invalidType: 'Seuls les fichiers CSV sont pris en charge',
      empty: 'Le fichier est vide',
      noValidRows: 'Aucune ligne valide trouvée. Colonnes attendues : timestamp, price',
    },
  },

  export: {
    button: 'Exporter',
    ariaLabel: 'Exporter les données',
    exportAs: 'Exporter en {{format}}',
    langSelector: "Langage de l'extrait de code",
    columns: {
      button: 'Colonnes',
      title: "Sélectionner les colonnes d'exportation",
      preset: {
        minimal: 'Minimal',
        standard: 'Standard',
        full: 'Complet',
      },
      search: 'Filtrer les colonnes…',
      available: 'Disponibles',
      noMatches: 'Aucune colonne correspondante',
      selectedOrder: 'Sélectionnées (glisser pour réordonner)',
      preview: 'Aperçu',
    },
  },

  settings: {
    title: 'Paramètres',
    close: 'Fermer les paramètres',
    sections: {
      data: 'Données',
      accessibility: 'Accessibilité',
      privacy: 'Confidentialité',
      language: 'Langue',
    },
    fields: {
      refreshInterval: 'Intervalle de rafraîchissement',
      chartTimeRange: 'Plage de temps du graphique',
      staleThreshold: "Seuil d'actif obsolète",
    },
    accessibility: {
      reducedMotion: 'Mouvement réduit',
      reducedMotionDesc: 'Désactive les animations pour les utilisateurs sensibles au mouvement',
      highContrast: 'Contraste élevé',
      highContrastDesc: 'Augmente le contraste des couleurs pour les malvoyants',
      largeText: 'Grand texte',
      largeTextDesc: 'Augmente la taille de la police de base dans tout le tableau de bord',
    },
    privacy: {
      enableAnalytics: "Activer l'analyse",
      enableAnalyticsDesc: 'Autoriser les analyses axées sur la confidentialité (désactivable).',
    },
    language: {
      label: "Langue de l'interface",
      rtlOverride: 'Forcer la mise en page RTL',
      rtlOverrideDesc: 'Forcer le sens RTL pour les tests sans changer de langue',
    },
    actions: {
      undo: 'Annuler',
      undoShortcut: 'Ctrl+Z',
      undoAriaLabel: 'Annuler la dernière modification',
      redo: 'Rétablir',
      redoShortcut: 'Ctrl+Shift+Z',
      redoAriaLabel: 'Rétablir la dernière modification annulée',
      clear: 'Effacer',
      clearAriaLabel: "Effacer l'historique d'annulation",
    },
  },

  apiDocs: {
    title: 'Documentation API',
    subtitle: "Endpoints REST et WebSocket exposés par l'Agrégateur Oracle de Prix Stellar.",
    openSpec: 'Ouvrir la spécification OpenAPI',
    baseUrl: 'URL de base :',
    ws: 'WS :',
    cacheStatus: 'Cache :',
    tryItOut: 'Essayer',
    sending: 'Envoi…',
    copy: 'Copier',
    copied: 'Copié !',
  },

  // ── Source descriptions (PriceCard tooltips) ──────────────────────────────
  sources: {
    chainlink:
      "Chainlink est un réseau d'oracles décentralisé qui fournit des données de prix infalsifiables provenant de fournisseurs de données premium.",
    redstone:
      'RedStone est un oracle modulaire qui diffuse des flux de prix signés à la demande, réduisant les coûts de gaz en stockant les données hors chaîne.',
    band: 'Band Protocol agrège des données du monde réel provenant de plusieurs sources et les rend disponibles en chaîne via des validateurs délégués.',
    reflector:
      'Reflector est un oracle natif de Stellar qui publie les prix des actifs directement sur le réseau Stellar.',
    defaultTooltip: '{{source}} a contribué un flux de prix à cette valeur agrégée.',
  },

  // ── Landing / Hero (#297) ─────────────────────────────────────────────────
  landing: {
    hero: {
      ariaLabel: 'Section héro de présentation du marché',
      liveStatus: 'En direct · Tous les oracles actifs',
      title: 'Stellar Unified Price Oracle',
      subtitle:
        "Prix d'actifs en temps réel agrégés depuis Chainlink, Redstone, Band et Reflector — diffusés vers votre application via REST & WebSocket.",
      cta: 'Ouvrir le tableau de bord',
      ctaAriaLabel: "Ouvrir le tableau de bord de l'oracle de prix",
      apiDocs: 'Docs API',
    },
    stats: {
      totalPairs: 'Paires suivies',
      totalPairsDetail: "paires d'actifs surveillées",
      activeSources: 'Sources oracle',
      activeSourcesDetail: 'fournisseurs de données actifs',
      avgConfidence: 'Confiance moy.',
      avgConfidenceDetail: 'sur toutes les paires',
      highConfidence: 'Haute confiance',
      highConfidenceDetail: 'paires au-dessus de 90%',
    },
    topPairs: {
      title: 'Meilleures paires par confiance',
      pairAriaLabel: 'Voir les détails de prix pour {{pair}}',
      sources: 'sources',
      confidence: 'conf.',
    },
    powered: {
      label: 'Propulsé par',
    },
  },

  // ── Drag-and-drop reordering (#294) ───────────────────────────────────────
  draggableGrid: {
    dragHint: 'Glisser pour réorganiser',
    ariaLabel: 'Glisser pour réorganiser les cartes de prix',
    dropTarget: 'Déposer ici',
  },

  // ── Touch gestures / Pull-to-refresh (#293) ───────────────────────────────
  wallet: {
    connect: 'Connecter le portefeuille',
    connecting: 'Connexion…',
    disconnect: 'Déconnecter',
    installFreighter: 'Installer Freighter',
    network: 'Réseau',
    address: 'Adresse',
    balance: 'Solde',
    balanceUnfunded: 'Non approvisionné',
    ariaConnected: 'Portefeuille connecté : {{address}}',
    gate: {
      title: 'Portefeuille requis',
      description:
        "Connectez un portefeuille Stellar pour utiliser les fonctions en chaîne comme le déploiement et la publication sur le contrat d'oracle.",
    },
  },
} as const

export default fr
