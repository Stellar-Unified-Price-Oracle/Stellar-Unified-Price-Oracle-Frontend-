const es = {
  nav: {
    home: 'Inicio',
    dashboard: 'Panel de control',
    apiDocs: 'Documentación API',
    toggleMenu: 'Alternar menú',
    toggleAlerts: 'Alternar alertas de precios',
    appName: 'Stellar Oracle',
  },
  footer: {
    text: 'Stellar Unified Price Oracle · Portal de desarrolladores y panel de análisis',
  },

  dashboard: {
    title: 'Panel de Oracle de Precios',
    subtitle: 'Agregado de Chainlink, Redstone, Band y Reflector',
    search: {
      placeholder: 'Buscar par de activos...',
      ariaLabel: 'Buscar par de activos',
    },
    filter: {
      toggle: 'Filtrar',
      ariaLabel: 'Alternar panel de filtros',
    },
    select: {
      button: 'Seleccionar',
      buttonWithCount: 'Seleccionar ({{count}})',
      buttonShort: 'Sel',
      ariaLabel: 'Alternar modo de selección',
    },
    viewToggle: {
      ariaLabel: 'Alternar vista',
      card: 'Vista de tarjetas',
      table: 'Vista de tabla',
    },
    alerts: {
      ariaLabel: 'Configurar canales de notificación',
      title: 'Alertas',
    },
    selection: {
      count: '{{count}} seleccionados',
      selectAll: 'Seleccionar todo',
      deselectAll: 'Deseleccionar todo',
      exportCsv: 'Exportar CSV',
    },
    emptyState: {
      noFeeds: 'No hay feeds de precios disponibles',
      noFeedsDetail: 'Conecte a la API del agregador para ver datos de precios.',
      noResults: 'Sin resultados',
      noResultsSearch: 'Sin resultados para "{{search}}"',
      noResultsFilterHint: 'Intente ajustar sus filtros.',
      noResultsSearchHint: 'Intente un término de búsqueda diferente.',
    },
    loadingAriaLabel: 'Cargando tarjetas de precios',
    feedsAriaLabel: 'Feeds de precios',
    // ── Touch gestures / Pull-to-refresh (#293) ─────────────────────────
    pullToRefresh: {
      pull: 'Desliza hacia abajo para actualizar',
      release: 'Suelta para actualizar',
      refreshing: 'Actualizando…',
    },
  },

  filter: {
    title: 'Filtros y Ordenar',
    clearAll: 'Limpiar todo ({{count}})',
    sources: 'Fuentes Oracle',
    lastUpdated: 'Última actualización',
    confidence: 'Confianza: {{min}}%–{{max}}%',
    confidenceMin: 'Mín',
    confidenceMax: 'Máx',
    priceRange: 'Rango de precios',
    priceMin: 'Mín',
    priceMax: 'Máx',
    sortBy: 'Ordenar por',
    sortDefault: 'Por defecto',
    sortDirection: {
      ascending: 'Ascendente',
      descending: 'Descendente',
      ariaLabel: 'Dirección de ordenación: {{direction}}',
    },
    updatedWithin: {
      all: 'Cualquier momento',
      '1h': '1 h',
      '6h': '6 h',
      '24h': '24 h',
      '7d': '7 d',
    },
    sort: {
      pair: 'Par (A–Z)',
      priceHigh: 'Precio (Mayor → Menor)',
      priceLow: 'Precio (Menor → Mayor)',
      confidence: 'Confianza',
      recent: 'Última actualización',
    },
    ariaLabels: {
      minConfidence: 'Confianza mínima',
      maxConfidence: 'Confianza máxima',
      sortBy: 'Ordenar por',
      minPrice: 'Precio mínimo',
      maxPrice: 'Precio máximo',
    },
  },

  priceCard: {
    updated: 'Actualizado {{time}}',
    confidence: '{{value}}% confianza',
    alertSet: 'Alerta activa',
    setAlert: 'Crear alerta',
    ariaLabel: 'Ver detalles de {{pair}}',
    alertAriaLabel: 'Crear alerta para {{pair}}',
    confidenceTooltip:
      'La confianza refleja cuán consistente es el precio entre las fuentes oracle. 100% significa que todas las fuentes coinciden exactamente.',
  },

  table: {
    ariaLabel: 'Tabla de feeds de precios',
    columns: {
      pair: 'Par',
      price: 'Precio',
      confidence: 'Confianza',
      sources: 'Fuentes',
      updated: 'Actualizado',
      alert: 'Alerta',
      select: 'Seleccionar',
    },
    row: {
      liveAriaLabel: 'Datos en vivo',
      alertAriaLabel: 'Alerta activa',
      rowAriaLabel: 'Ver detalles de {{pair}}',
      alertSet: 'Alerta activa',
      setAlert: 'Crear alerta',
      alertButtonAriaLabel: 'Crear alerta para {{pair}}',
    },
  },

  alertModal: {
    titleNew: 'Nueva Alerta de Precio',
    titleEdit: 'Editar Alerta',
    ariaLabelNew: 'Crear alerta de precio',
    ariaLabelEdit: 'Editar alerta de precio',
    close: 'Cerrar modal',
    firedOnceNotice: 'Esta alerta se activó el {{time}} ({{count}} en total). Vuelve a habilitarla para reutilizarla.',
    fireCount: 'Activada {{count}} vez(es)',
    fields: {
      assetPair: 'Par de activos',
      assetPairPlaceholder: 'ej. BTC/USD',
      upperThreshold: 'Umbral superior',
      upperPlaceholder: 'Precio máximo',
      lowerThreshold: 'Umbral inferior',
      lowerPlaceholder: 'Precio mínimo',
      triggerOnce: 'Activar una vez',
      triggerOnceDescription: 'La alerta se desactiva tras ser activada',
      alertMode: 'Modo de alerta',
      alertModeAbsolute: 'Precio absoluto',
      alertModePercentage: '% Movimiento de precio',
      percentageThreshold: 'Umbral de cambio',
      percentageWindow: 'Ventana de tiempo',
      percentageDirection: 'Dirección',
      percentageRelativeTo: 'Relativo a',
      window5min: '5 minutos',
      window15min: '15 minutos',
      window1hr: '1 hora',
      window24hr: '24 horas',
      directionUp: '↑ Subida',
      directionDown: '↓ Bajada',
      directionEither: '↕ Cualquiera',
      relativeToOpen: 'Apertura del período',
      relativeToPreviousClose: 'Cierre anterior',
      relativeToMovingAverage: 'Media móvil',
      alertType: 'Tipo de alerta',
      alertTypeOneTime: 'Una vez',
      alertTypePersistent: 'Persistente',
      alertTypeOneTimeDesc: 'Se activa una vez y se desactiva. Vuélvela a habilitar para reutilizarla.',
      alertTypePersistentDesc: 'Se activa cada vez que se cumple la condición. Registra el contador.',
      cooldown: 'Espera entre alertas',
      cooldownOff: 'Desactivada (activar de inmediato)',
      cooldown1min: '1 minuto',
      cooldown5min: '5 minutos',
      cooldown15min: '15 minutos',
      cooldown1hr: '1 hora',
      cooldownDesc: 'Tiempo mínimo entre reactivaciones, para evitar spam de notificaciones cuando el precio oscila alrededor del umbral.',
    },
    actions: {
      delete: 'Eliminar alerta',
      cancel: 'Cancelar',
      save: 'Guardar cambios',
      create: 'Crear alerta',
      reEnable: 'Rehabilitar alerta',
    },
    validation: {
      assetPairRequired: 'El par de activos es obligatorio',
      atLeastOneThreshold: 'Se requiere al menos un umbral',
      mustBePositive: 'Debe ser un número positivo',
      upperGreaterThanLower: 'Debe ser mayor que el umbral inferior',
      lowerLessThanUpper: 'Debe ser menor que el umbral superior',
    },
    conditions: {
      title: 'Condiciones adicionales',
      description: 'Añade condiciones extra al campo anterior, combinadas con AND/OR.',
      add: '+ Añadir condición',
      logicLabel: 'Combinar condiciones con',
      and: 'Y',
      or: 'O',
      operatorLabel: 'Operador de la condición {{index}}',
      valueLabel: 'Valor de la condición {{index}}',
      windowLabel: 'Ventana de tiempo de la condición {{index}}',
      remove: 'Eliminar condición {{index}}',
      priceUnit: 'USD',
      operator_gt: '>',
      operator_gte: '≥',
      operator_lt: '<',
      operator_lte: '≤',
      operator_eq: '=',
    },
    escalation: {
      enable: 'Activar política de escalado',
      description: 'Notifica a canales adicionales con retrasos crecientes mientras la alerta siga activa.',
      addStep: '+ Añadir paso',
      channelLabel: 'Canal del paso {{step}}',
      delayLabel: 'Retraso en minutos del paso {{step}}',
      removeStep: 'Eliminar paso {{step}}',
      minutesSuffix: 'min',
      channel_inApp: 'En la app',
      channel_email: 'Correo',
      channel_webPush: 'Push web',
      channel_webhook: 'Webhook',
      channel_telegram: 'Telegram',
      channel_discord: 'Discord',
      error_invalidDelay: 'Paso {{step}}: el retraso debe ser un número de minutos no negativo',
      error_outOfOrder: 'Paso {{step}}: el retraso no puede ser anterior al del paso previo',
    },
    presets: {
      title: 'Empezar desde una plantilla',
      myPresets: 'Mis plantillas',
      deleteCustom: 'Eliminar plantilla {{name}}',
      nameLabel: 'Nombre de la plantilla',
      descriptionLabel: 'Descripción (opcional)',
      save: 'Guardar plantilla',
      saveCurrentAsPreset: '+ Guardar configuración actual como plantilla',
    },
  },

  alertPanel: {
    title: 'Alertas de Precio',
    newBadge: '{{count}} Nueva',
    empty: 'No hay alertas configuradas',
    close: 'Cerrar panel de alertas',
    sections: {
      triggered: 'Activadas',
      active: 'Alertas activas',
      inactive: 'Inactivas',
      snoozed: 'Silenciadas',
      firedOnce: 'Disparadas (Una vez)',
    },
    triggered: {
      justNow: 'Ahora mismo',
      priceCrossed: 'El precio cruzó',
      markRead: 'Marcar leída',
      delete: 'Eliminar',
    },
    active: {
      pause: 'Pausar alerta',
      delete: 'Eliminar alerta',
    },
    inactive: {
      resume: 'Reanudar alerta',
      delete: 'Eliminar alerta',
    },
    snooze: {
      button: 'Silenciar',
      unsnooze: 'Quitar silencio',
      '15min': '15 minutos',
      '1hr': '1 hora',
      '4hr': '4 horas',
      '24hr': '24 horas',
      tomorrow: 'Hasta mañana (8 AM)',
      expiresInMins: 'Silenciada {{mins}}m',
      expiresInHrs: 'Silenciada {{hrs}}h',
    },
    badge: {
      oneTime: 'Una vez',
      persistent: 'Persistente',
      snoozed: 'Silenciada',
      fired: 'Disparada',
    },
    fired: {
      at: 'Disparada el {{time}}',
      reEnable: 'Rehabilitar alerta',
    },
    conditions: {
      between: 'Entre ${{lower}} y ${{upper}}',
      above: '↑ Por encima de ${{upper}}',
      below: '↓ Por debajo de ${{lower}}',
      none: 'Sin umbral',
      percentage: '{{direction}} {{pct}}% en {{window}}',
      dir_up: '↑ Subida',
      dir_down: '↓ Bajada',
      dir_either: '↕ Cualquiera',
    },
    tabs: {
      alerts: 'Alertas',
      history: 'Historial',
    },
    history: {
      empty: 'Aún no se ha disparado ninguna alerta',
      searchPlaceholder: 'Buscar por par de activos…',
      noResults: 'Ningún registro coincide con tu búsqueda',
      clear: 'Borrar historial',
      clearConfirm: '¿Borrar todo el historial de alertas? Esta acción no se puede deshacer.',
      exportCsv: 'Exportar CSV',
      exportJson: 'Exportar JSON',
      count_one: '{{count}} alerta disparada',
      count_other: '{{count}} alertas disparadas',
      priceAt: 'Precio: ${{price}}',
    },
    escalation: {
      label: 'Escalado:',
      progress: '{{fired}} de {{total}} pasos disparados',
      historyBadge: 'Escalado · {{channel}}',
    },
  },

  alertPresets: {
    whaleMove: {
      name: 'Movimiento de ballena',
      description: 'Una gran oscilación de precio en cualquier dirección en poco tiempo.',
      useCase: 'Detecta movimientos repentinos de un gran tenedor antes de que reaccione el mercado.',
    },
    breakout: {
      name: 'Ruptura',
      description: 'Impulso confirmado en dos ventanas: un fuerte movimiento de 1 hora que aún acelera en los últimos 15 minutos.',
      useCase: 'Detecta un movimiento que es más que ruido: la tendencia está confirmada, no solo empezando.',
    },
    pegBreak: {
      name: 'Ruptura de paridad de stablecoin',
      description: 'El precio se desvía más de un 1% de su paridad de $1.00 en cualquier dirección.',
      useCase: 'Recibe una alerta temprana si una stablecoin que usas está perdiendo su paridad.',
    },
  },

  connection: {
    live: 'En vivo',
    connecting: 'Conectando',
    reconnecting: 'Reconectando',
    offline: 'Sin conexión',
    rateLimited: 'Límite de tasa',
    rateLimitedWithTimer: 'Límite de tasa ({{seconds}}s)',
    ariaLabel: 'WebSocket {{status}}',
    rateLimitedAriaLabel: 'API con límite de tasa',
    tooltips: {
      connected:
        'WebSocket conectado. Las actualizaciones de precios se transmiten en tiempo real.',
      connecting:
        'Estableciendo conexión WebSocket con el servidor de feeds de precios.',
      reconnecting:
        'Se perdió la conexión WebSocket. Intentando reconectar automáticamente.',
      disconnected:
        'WebSocket sin conexión. Los precios se actualizan sólo mediante sondeo REST.',
      rateLimited:
        'La API está temporalmente limitada. Las solicitudes se reanudarán después del período de reintento.',
    },
  },

  error: {
    title: 'Algo salió mal',
    defaultMessage: 'Ocurrió un error inesperado.',
    reload: 'Recargar página',
  },

  network: {
    offline: 'Sin conexión a internet',
    offlineDetail: 'Los datos pueden estar desactualizados hasta que se reconecte',
  },

  pwa: {
    installTitle: 'Instalar Stellar Oracle',
    installDetail: 'Añade esta app a tu dispositivo para acceso rápido y uso sin conexión.',
    installAction: 'Instalar',
    installDismiss: 'Ahora no',
    updateTitle: 'Actualización disponible',
    updateDetail: 'Una nueva versión de la app está lista.',
    updateAction: 'Recargar',
    updateDismiss: 'Más tarde',
  },

  notFound: {
    heading: '404',
    message: 'Página no encontrada',
    backToDashboard: 'Volver al panel',
  },

  priceDetail: {
    back: 'Volver',
    backAriaLabel: 'Volver al panel de control',
    sections: {
      currentPrice: 'Precio actual',
      oracleSources: 'Fuentes Oracle',
      priceHistory: 'Historial de precios (paginado)',
      importData: 'Importar datos de precios',
    },
    live: 'EN VIVO',
    confidence: '{{value}}% confianza',
    updated: 'Actualizado {{time}}',
    historyError: 'Error al cargar el historial de precios: {{message}}',
    emptyState: {
      title: 'No hay datos de precio disponibles',
      detail: 'No hay datos de precio disponibles para este par.',
    },
  },

  csv: {
    imported: 'Datos CSV importados — se muestran como superposición en el gráfico',
    clear: 'Limpiar',
    dropOrBrowse: 'Suelta un archivo CSV o',
    browse: 'examina',
    hint: 'Columnas: timestamp, price — máx 5 MB',
    uploadAriaLabel: 'Subir archivo CSV para importar datos de precios',
    errors: {
      tooLarge: 'El archivo supera el límite de 5 MB',
      invalidType: 'Solo se admiten archivos CSV',
      empty: 'El archivo está vacío',
      noValidRows: 'No se encontraron filas válidas. Columnas esperadas: timestamp, price',
    },
  },

  export: {
    button: 'Exportar',
    ariaLabel: 'Exportar datos',
    exportAs: 'Exportar como {{format}}',
    langSelector: 'Lenguaje del fragmento de código',
  },

  settings: {
    title: 'Configuración',
    close: 'Cerrar configuración',
    sections: {
      data: 'Datos',
      accessibility: 'Accesibilidad',
      privacy: 'Privacidad',
      language: 'Idioma',
    },
    fields: {
      refreshInterval: 'Intervalo de actualización',
      chartTimeRange: 'Rango de tiempo del gráfico',
      staleThreshold: 'Umbral de activo desactualizado',
    },
    accessibility: {
      reducedMotion: 'Movimiento reducido',
      reducedMotionDesc: 'Desactiva animaciones y transiciones para usuarios sensibles al movimiento',
      highContrast: 'Alto contraste',
      highContrastDesc: 'Aumenta las relaciones de contraste de color para usuarios con baja visión',
      largeText: 'Texto grande',
      largeTextDesc: 'Aumenta el tamaño de fuente base en todo el panel',
    },
    privacy: {
      enableAnalytics: 'Habilitar análisis',
      enableAnalyticsDesc: 'Permitir análisis centrados en privacidad para el uso de funciones (se puede cancelar).',
    },
    language: {
      label: 'Idioma de la interfaz',
      rtlOverride: 'Forzar diseño RTL',
      rtlOverrideDesc: 'Anular dirección a RTL para pruebas sin cambiar de idioma',
    },
    actions: {
      undo: 'Deshacer',
      undoShortcut: 'Ctrl+Z',
      undoAriaLabel: 'Deshacer último cambio',
      redo: 'Rehacer',
      redoShortcut: 'Ctrl+Shift+Z',
      redoAriaLabel: 'Rehacer último cambio deshecho',
      clear: 'Limpiar',
      clearAriaLabel: 'Limpiar historial de deshacer',
    },
  },

  apiDocs: {
    title: 'Documentación de la API',
    subtitle:
      'Endpoints REST y WebSocket expuestos por el Agregador Oracle Unificado de Precios de Stellar.',
    openSpec: 'Abrir especificación OpenAPI',
    baseUrl: 'URL base:',
    ws: 'WS:',
    tryItOut: 'Probar',
    sending: 'Enviando…',
    copy: 'Copiar',
    copied: '¡Copiado!',
  },

  sources: {
    chainlink:
      'Chainlink es una red de oráculos descentralizada que entrega datos de precios a prueba de manipulaciones de proveedores de datos premium.',
    redstone:
      'RedStone es un oráculo modular que transmite feeds de precios firmados bajo demanda, reduciendo los costos de gas al almacenar datos fuera de la cadena.',
    band: 'Band Protocol agrega datos del mundo real de múltiples fuentes y los pone disponibles en cadena a través de validadores delegados.',
    reflector:
      'Reflector es un oráculo nativo de Stellar que publica precios de activos directamente en la red Stellar.',
    defaultTooltip: '{{source}} contribuyó un feed de precios a este valor agregado.',
  },

  // ── Landing / Hero (#297) ─────────────────────────────────────────────────
  landing: {
    hero: {
      ariaLabel: 'Sección de presentación del mercado',
      liveStatus: 'En vivo · Todos los oráculos activos',
      title: 'Stellar Unified Price Oracle',
      subtitle:
        'Precios de activos en tiempo real y agregados de Chainlink, Redstone, Band y Reflector — transmitidos a tu aplicación vía REST y WebSocket.',
      cta: 'Abrir Panel',
      ctaAriaLabel: 'Abrir el panel del oráculo de precios',
      apiDocs: 'Docs API',
    },
    stats: {
      totalPairs: 'Pares seguidos',
      totalPairsDetail: 'pares de activos monitoreados',
      activeSources: 'Fuentes oracle',
      activeSourcesDetail: 'proveedores de datos activos',
      avgConfidence: 'Confianza media',
      avgConfidenceDetail: 'entre todos los pares',
      highConfidence: 'Alta confianza',
      highConfidenceDetail: 'pares por encima del 90%',
    },
    topPairs: {
      title: 'Principales pares por confianza',
      pairAriaLabel: 'Ver detalles de precio para {{pair}}',
      sources: 'fuentes',
      confidence: 'conf.',
    },
    powered: {
      label: 'Impulsado por',
    },
  },

  // ── Drag-and-drop reordering (#294) ───────────────────────────────────────
  draggableGrid: {
    dragHint: 'Arrastra para reordenar',
    ariaLabel: 'Arrastra para reordenar las tarjetas de precios',
    dropTarget: 'Soltar aquí',
  },

  // ── Touch gestures / Pull-to-refresh (#293) ───────────────────────────────
} as const

export default es
