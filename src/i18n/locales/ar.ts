/**
 * Arabic (ar) locale — placeholder translations for RTL layout testing.
 *
 * All strings are placeholders that mirror the English originals so the app
 * remains fully usable while the UI is exercised in an RTL context.
 * Replace the values here with properly reviewed Arabic copy before shipping.
 */
const ar = {
  // ── Layout ──────────────────────────────────────────────────────────────
  nav: {
    home: 'الرئيسية',
    dashboard: 'لوحة التحكم',
    apiDocs: 'وثائق API',
    toggleMenu: 'تبديل القائمة',
    toggleAlerts: 'تبديل تنبيهات الأسعار',
    appName: 'Stellar Oracle',
  },
  footer: {
    text: 'Stellar Unified Price Oracle · بوابة المطورين ولوحة التحليلات',
  },

  // ── Dashboard page ───────────────────────────────────────────────────────
  dashboard: {
    title: 'لوحة تحكم أوراكل الأسعار',
    subtitle: 'مجمّع من Chainlink وRedstone وBand وReflector',
    search: {
      placeholder: 'ابحث بزوج الأصول...',
      ariaLabel: 'ابحث بزوج الأصول',
    },
    filter: {
      toggle: 'تصفية',
      ariaLabel: 'تبديل لوحة التصفية',
    },
    select: {
      button: 'اختر',
      buttonWithCount: 'اختر ({{count}})',
      buttonShort: 'اختر',
      ariaLabel: 'تبديل وضع الاختيار',
    },
    viewToggle: {
      ariaLabel: 'تبديل العرض',
      card: 'عرض البطاقات',
      table: 'عرض الجدول',
    },
    alerts: {
      ariaLabel: 'تهيئة قنوات الإشعارات',
      title: 'التنبيهات',
    },
    selection: {
      count: '{{count}} محدد',
      selectAll: 'اختر الكل',
      deselectAll: 'إلغاء الاختيار الكلي',
      exportCsv: 'تصدير CSV',
    },
    emptyState: {
      noFeeds: 'لا توجد تغذيات أسعار',
      noFeedsDetail: 'اتصل بـ aggregator API لرؤية بيانات الأسعار.',
      noResults: 'لا توجد نتائج',
      noResultsSearch: 'لا توجد نتائج لـ "{{search}}"',
      noResultsFilterHint: 'حاول ضبط المرشحات.',
      noResultsSearchHint: 'جرب مصطلح بحث مختلفاً.',
    },
    loadingAriaLabel: 'جارٍ تحميل بطاقات الأسعار',
    feedsAriaLabel: 'تغذيات الأسعار',
    pullToRefresh: {
      pull: 'اسحب للأسفل للتحديث',
      release: 'أطلق للتحديث',
      refreshing: 'جارٍ التحديث…',
    },
  },

  // ── FilterPanel ──────────────────────────────────────────────────────────
  filter: {
    title: 'المرشحات والترتيب',
    clearAll: 'مسح الكل ({{count}})',
    sources: 'مصادر الأوراكل',
    lastUpdated: 'آخر تحديث',
    confidence: 'الثقة: {{min}}%–{{max}}%',
    confidenceMin: 'الأدنى',
    confidenceMax: 'الأقصى',
    priceRange: 'نطاق السعر',
    priceMin: 'الأدنى',
    priceMax: 'الأقصى',
    sortBy: 'ترتيب حسب',
    sortDefault: 'افتراضي',
    sortDirection: {
      ascending: 'تصاعدي',
      descending: 'تنازلي',
      ariaLabel: 'اتجاه الترتيب: {{direction}}',
    },
    updatedWithin: {
      all: 'أي وقت',
      '1h': 'ساعة',
      '6h': '٦ ساعات',
      '24h': '٢٤ ساعة',
      '7d': '٧ أيام',
    },
    sort: {
      pair: 'الزوج (أ–ي)',
      priceHigh: 'السعر (من الأعلى)',
      priceLow: 'السعر (من الأدنى)',
      confidence: 'الثقة',
      recent: 'آخر تحديث',
    },
    ariaLabels: {
      minConfidence: 'الحد الأدنى للثقة',
      maxConfidence: 'الحد الأقصى للثقة',
      sortBy: 'ترتيب حسب',
      minPrice: 'الحد الأدنى للسعر',
      maxPrice: 'الحد الأقصى للسعر',
    },
  },

  // ── PriceCard ────────────────────────────────────────────────────────────
  priceCard: {
    updated: 'تحديث {{time}}',
    confidence: 'ثقة {{value}}%',
    alertSet: 'تنبيه مضبوط',
    setAlert: 'ضبط تنبيه',
    ariaLabel: 'عرض تفاصيل {{pair}}',
    alertAriaLabel: 'ضبط تنبيه لـ {{pair}}',
    confidenceTooltip:
      'تعكس الثقة مدى اتساق السعر عبر مصادر الأوراكل. ١٠٠٪ تعني أن جميع المصادر تتفق تماماً.',
  },

  // ── PriceTableView ────────────────────────────────────────────────────────
  table: {
    ariaLabel: 'جدول تغذيات الأسعار',
    columns: {
      pair: 'الزوج',
      price: 'السعر',
      confidence: 'الثقة',
      sources: 'المصادر',
      updated: 'تحديث',
      alert: 'تنبيه',
      select: 'اختر',
    },
    row: {
      liveAriaLabel: 'بيانات مباشرة',
      alertAriaLabel: 'تنبيه نشط',
      rowAriaLabel: 'عرض تفاصيل {{pair}}',
      alertSet: 'تنبيه مضبوط',
      setAlert: 'ضبط تنبيه',
      alertButtonAriaLabel: 'ضبط تنبيه لـ {{pair}}',
    },
  },

  // ── AlertModal ────────────────────────────────────────────────────────────
  alertModal: {
    titleNew: 'تنبيه سعر جديد',
    titleEdit: 'تعديل التنبيه',
    ariaLabelNew: 'إنشاء تنبيه سعر',
    ariaLabelEdit: 'تعديل تنبيه السعر',
    close: 'إغلاق النافذة',
    firedOnceNotice: 'تفعّل هذا التنبيه في {{time}} ({{count}} مرة إجمالاً). أعد تفعيله للاستخدام مجدداً.',
    fireCount: 'تفعّل {{count}} مرة/مرات',
    fields: {
      assetPair: 'زوج الأصول',
      assetPairPlaceholder: 'مثال BTC/USD',
      upperThreshold: 'الحد الأعلى',
      upperPlaceholder: 'الحد الأقصى للسعر',
      lowerThreshold: 'الحد الأدنى',
      lowerPlaceholder: 'الحد الأدنى للسعر',
      triggerOnce: 'التفعيل مرة واحدة',
      triggerOnceDescription: 'يُلغى التنبيه تلقائياً بعد التفعيل',
      alertMode: 'وضع التنبيه',
      alertModeAbsolute: 'سعر مطلق',
      alertModePercentage: 'حركة السعر %',
      percentageThreshold: 'عتبة التغيير',
      percentageWindow: 'النافذة الزمنية',
      percentageDirection: 'الاتجاه',
      percentageRelativeTo: 'نسبةً إلى',
      window5min: '٥ دقائق',
      window15min: '١٥ دقيقة',
      window1hr: 'ساعة',
      window24hr: '٢٤ ساعة',
      directionUp: '↑ صعود',
      directionDown: '↓ هبوط',
      directionEither: '↕ كلاهما',
      relativeToOpen: 'فتح الفترة',
      relativeToPreviousClose: 'الإغلاق السابق',
      relativeToMovingAverage: 'المتوسط المتحرك',
      alertType: 'نوع التنبيه',
      alertTypeOneTime: 'مرة واحدة',
      alertTypePersistent: 'مستمر',
      alertTypeOneTimeDesc: 'يُفعَّل مرة واحدة ثم يُعطَّل تلقائياً. أعد تفعيله لإعادة الاستخدام.',
      alertTypePersistentDesc: 'يُفعَّل في كل مرة تتحقق الحالة. يتتبع عدد مرات التفعيل.',
      cooldown: 'فترة الانتظار بين التنبيهات',
      cooldownOff: 'إيقاف (التفعيل الفوري)',
      cooldown1min: 'دقيقة',
      cooldown5min: '٥ دقائق',
      cooldown15min: '١٥ دقيقة',
      cooldown1hr: 'ساعة',
      cooldownDesc: 'الحد الأدنى للوقت بين إعادة التفعيل لتجنب إغراق الإشعارات عند تذبذب السعر حول عتبتك.',
    },
    actions: {
      delete: 'حذف التنبيه',
      cancel: 'إلغاء',
      save: 'حفظ التغييرات',
      create: 'إنشاء تنبيه',
      reEnable: 'إعادة تفعيل التنبيه',
    },
    validation: {
      assetPairRequired: 'زوج الأصول مطلوب',
      atLeastOneThreshold: 'مطلوب عتبة واحدة على الأقل',
      mustBePositive: 'يجب أن يكون رقماً موجباً',
      upperGreaterThanLower: 'يجب أن يكون أكبر من الحد الأدنى',
      lowerLessThanUpper: 'يجب أن يكون أصغر من الحد الأعلى',
    },
    conditions: {
      title: 'شروط إضافية',
      description: 'أضف شروطاً إضافية فوق الحقل أعلاه، يتم دمجها باستخدام AND/OR.',
      add: '+ إضافة شرط',
      logicLabel: 'دمج الشروط باستخدام',
      and: 'و',
      or: 'أو',
      operatorLabel: 'عامل الشرط {{index}}',
      valueLabel: 'قيمة الشرط {{index}}',
      windowLabel: 'النافذة الزمنية للشرط {{index}}',
      remove: 'إزالة الشرط {{index}}',
      priceUnit: 'دولار',
      operator_gt: '>',
      operator_gte: '≥',
      operator_lt: '<',
      operator_lte: '≤',
      operator_eq: '=',
    },
    escalation: {
      enable: 'تفعيل سياسة التصعيد',
      description: 'إشعار قنوات إضافية بتأخيرات متزايدة طالما استمر الاختراق.',
      addStep: '+ إضافة خطوة',
      channelLabel: 'قناة الخطوة {{step}}',
      delayLabel: 'التأخير بالدقائق للخطوة {{step}}',
      removeStep: 'إزالة الخطوة {{step}}',
      minutesSuffix: 'د',
      channel_inApp: 'داخل التطبيق',
      channel_email: 'البريد الإلكتروني',
      channel_webPush: 'إشعار الويب',
      channel_webhook: 'Webhook',
      channel_telegram: 'تيليجرام',
      channel_discord: 'ديسكورد',
      error_invalidDelay: 'الخطوة {{step}}: يجب أن يكون التأخير عدد دقائق غير سالب',
      error_outOfOrder: 'الخطوة {{step}}: لا يمكن أن يكون التأخير أبكر من الخطوة السابقة',
    },
    presets: {
      title: 'ابدأ من قالب جاهز',
      myPresets: 'قوالبي',
      deleteCustom: 'حذف القالب {{name}}',
      nameLabel: 'اسم القالب',
      descriptionLabel: 'الوصف (اختياري)',
      save: 'حفظ القالب',
      saveCurrentAsPreset: '+ حفظ الإعدادات الحالية كقالب',
    },
  },

  // ── AlertPanel ────────────────────────────────────────────────────────────
  alertPanel: {
    title: 'تنبيهات الأسعار',
    newBadge: '{{count}} جديد',
    empty: 'لم يتم ضبط أي تنبيهات بعد',
    close: 'إغلاق لوحة التنبيهات',
    sections: {
      triggered: 'مُفعَّل',
      active: 'تنبيهات نشطة',
      inactive: 'غير نشط',
      snoozed: 'مؤجل',
      firedOnce: 'مُفعَّل (مرة واحدة)',
    },
    triggered: {
      justNow: 'الآن',
      priceCrossed: 'السعر تجاوز',
      markRead: 'وضع علامة مقروء',
      delete: 'حذف',
    },
    active: {
      pause: 'إيقاف التنبيه مؤقتاً',
      delete: 'حذف التنبيه',
    },
    inactive: {
      resume: 'استئناف التنبيه',
      delete: 'حذف التنبيه',
    },
    snooze: {
      button: 'تأجيل',
      unsnooze: 'إلغاء التأجيل',
      '15min': '١٥ دقيقة',
      '1hr': 'ساعة',
      '4hr': '٤ ساعات',
      '24hr': '٢٤ ساعة',
      tomorrow: 'حتى الغد (٨ صباحاً)',
      expiresInMins: 'مؤجل لـ {{mins}} دقيقة',
      expiresInHrs: 'مؤجل لـ {{hrs}} ساعة',
    },
    badge: {
      oneTime: 'مرة واحدة',
      persistent: 'مستمر',
      snoozed: 'مؤجل',
      fired: 'مُفعَّل',
    },
    fired: {
      at: 'تفعّل في {{time}}',
      reEnable: 'إعادة تفعيل التنبيه',
    },
    conditions: {
      between: 'بين ${{lower}} و ${{upper}}',
      above: '↑ فوق ${{upper}}',
      below: '↓ تحت ${{lower}}',
      none: 'لا عتبة',
      percentage: '{{direction}} {{pct}}% في {{window}}',
      dir_up: '↑ صعود',
      dir_down: '↓ هبوط',
      dir_either: '↕ كلاهما',
    },
    tabs: {
      alerts: 'التنبيهات',
      history: 'السجل',
    },
    history: {
      empty: 'لم يُفعَّل أي تنبيه بعد',
      searchPlaceholder: 'ابحث بزوج الأصول…',
      noResults: 'لا توجد إدخالات تاريخ تطابق بحثك',
      clear: 'مسح السجل',
      clearConfirm: 'مسح كل سجل التنبيهات؟ لا يمكن التراجع عن هذا.',
      exportCsv: 'تصدير CSV',
      exportJson: 'تصدير JSON',
      count_one: '{{count}} تنبيه مُفعَّل',
      count_other: '{{count}} تنبيهات مُفعَّلة',
      priceAt: 'السعر: ${{price}}',
    },
    escalation: {
      label: 'التصعيد:',
      progress: 'تم تفعيل {{fired}} من {{total}} خطوات',
      historyBadge: 'تصعيد · {{channel}}',
    },
  },

  // ── Alert preset library (#486) ─────────────────────────────────────────
  alertPresets: {
    whaleMove: {
      name: 'تحرك الحوت',
      description: 'تقلب سعري كبير في أي اتجاه خلال فترة قصيرة.',
      useCase: 'رصد التحركات المفاجئة من حائز كبير قبل أن يتفاعل السوق الأوسع.',
    },
    breakout: {
      name: 'اختراق',
      description: 'زخم مؤكد عبر نافذتين: تحرك قوي خلال ساعة لا يزال يتسارع في آخر 15 دقيقة.',
      useCase: 'رصد تحرك يتجاوز مجرد الضوضاء — الاتجاه مؤكد وليس مجرد بداية.',
    },
    pegBreak: {
      name: 'كسر ربط العملة المستقرة',
      description: 'انحراف السعر أكثر من 1% عن ربطه بـ 1.00 دولار في أي اتجاه.',
      useCase: 'تحذير مبكر إذا كانت عملة مستقرة تحتفظ بها تفقد ربطها.',
    },
  },

  // ── ConnectionBadge ───────────────────────────────────────────────────────
  connection: {
    live: 'مباشر',
    connecting: 'جارٍ الاتصال',
    reconnecting: 'إعادة الاتصال',
    offline: 'غير متصل',
    rateLimited: 'مقيّد بمعدل',
    rateLimitedWithTimer: 'مقيّد بمعدل ({{seconds}}ث)',
    ariaLabel: 'WebSocket {{status}}',
    rateLimitedAriaLabel: 'API مقيّد بمعدل',
    tooltips: {
      connected: 'WebSocket متصل. تحديثات الأسعار تتدفق في الوقت الفعلي.',
      connecting: 'جارٍ إنشاء اتصال WebSocket بخادم تغذية الأسعار.',
      reconnecting: 'انقطع اتصال WebSocket. جارٍ إعادة الاتصال تلقائياً.',
      disconnected: 'WebSocket غير متصل. الأسعار تُحدَّث عبر REST polling فقط.',
      rateLimited: 'API مقيّد بمعدل مؤقتاً. ستستأنف الطلبات بعد انتهاء نافذة الانتظار.',
    },
  },

  // ── ErrorBoundary ─────────────────────────────────────────────────────────
  error: {
    title: 'حدث خطأ',
    defaultMessage: 'حدث خطأ غير متوقع.',
    reload: 'إعادة تحميل الصفحة',
  },

  // ── NetworkStatusBanner ───────────────────────────────────────────────────
  network: {
    offline: 'لا يوجد اتصال بالإنترنت',
    offlineDetail: 'قد تكون البيانات قديمة حتى تعيد الاتصال',
  },

  // ── NotFound page ─────────────────────────────────────────────────────────
  notFound: {
    heading: '٤٠٤',
    message: 'الصفحة غير موجودة',
    backToDashboard: 'العودة للوحة التحكم',
  },

  // ── PriceDetail page ──────────────────────────────────────────────────────
  priceDetail: {
    back: 'رجوع',
    backAriaLabel: 'العودة للوحة التحكم',
    sections: {
      currentPrice: 'السعر الحالي',
      oracleSources: 'مصادر الأوراكل',
      priceHistory: 'تاريخ الأسعار (مقسّم)',
      importData: 'استيراد بيانات الأسعار',
    },
    live: 'مباشر',
    confidence: 'ثقة {{value}}%',
    updated: 'تحديث {{time}}',
    historyError: 'فشل تحميل تاريخ الأسعار: {{message}}',
    emptyState: {
      title: 'لا تتوفر بيانات أسعار',
      detail: 'لا تتوفر بيانات أسعار لهذا الزوج.',
    },
  },

  // ── CsvImportZone ─────────────────────────────────────────────────────────
  csv: {
    imported: 'تم استيراد بيانات CSV — تُعرض كطبقة على الرسم البياني',
    clear: 'مسح',
    dropOrBrowse: 'أسقط ملف CSV أو',
    browse: 'تصفح',
    hint: 'الأعمدة: timestamp, price — الحد الأقصى ٥ ميغابايت',
    uploadAriaLabel: 'تحميل ملف CSV لاستيراد بيانات الأسعار',
    errors: {
      tooLarge: 'الملف يتجاوز حد ٥ ميغابايت',
      invalidType: 'ملفات CSV فقط مدعومة',
      empty: 'الملف فارغ',
      noValidRows: 'لم يُعثر على صفوف صالحة. الأعمدة المتوقعة: timestamp, price',
    },
  },

  // ── ExportButton ──────────────────────────────────────────────────────────
  export: {
    button: 'تصدير',
    ariaLabel: 'تصدير البيانات',
    exportAs: 'تصدير كـ {{format}}',
    langSelector: 'لغة مقتطف الكود',
    columns: {
      button: 'الأعمدة',
      title: 'اختر أعمدة التصدير',
      preset: {
        minimal: 'أدنى',
        standard: 'قياسي',
        full: 'كامل',
      },
      search: 'تصفية الأعمدة…',
      available: 'متاح',
      noMatches: 'لا توجد أعمدة مطابقة',
      selectedOrder: 'محدد (اسحب لإعادة الترتيب)',
      preview: 'معاينة',
    },
  },

  // ── SettingsPanel ─────────────────────────────────────────────────────────
  settings: {
    title: 'الإعدادات',
    close: 'إغلاق الإعدادات',
    sections: {
      data: 'البيانات',
      accessibility: 'إمكانية الوصول',
      privacy: 'الخصوصية',
      language: 'اللغة',
    },
    fields: {
      refreshInterval: 'فترة التحديث',
      chartTimeRange: 'نطاق وقت الرسم البياني',
      staleThreshold: 'حد الأصول القديمة',
    },
    accessibility: {
      reducedMotion: 'تقليل الحركة',
      reducedMotionDesc: 'تعطيل الرسوم المتحركة والانتقالات للمستخدمين الحساسين للحركة',
      highContrast: 'تباين عالٍ',
      highContrastDesc: 'زيادة نسب تباين الألوان للمستخدمين ذوي الإعاقة البصرية',
      largeText: 'نص كبير',
      largeTextDesc: 'زيادة حجم الخط الأساسي في لوحة التحكم',
    },
    privacy: {
      enableAnalytics: 'تفعيل التحليلات',
      enableAnalyticsDesc: 'السماح بتحليلات مراعية للخصوصية لاستخدام الميزات (يمكن الإلغاء).',
    },
    language: {
      label: 'لغة الواجهة',
      rtlOverride: 'فرض تخطيط RTL',
      rtlOverrideDesc: 'تجاوز الاتجاه إلى RTL للاختبار دون تغيير اللغة',
    },
    actions: {
      undo: 'تراجع',
      undoShortcut: 'Ctrl+Z',
      undoAriaLabel: 'التراجع عن آخر تغيير',
      redo: 'إعادة',
      redoShortcut: 'Ctrl+Shift+Z',
      redoAriaLabel: 'إعادة آخر تغيير تم التراجع عنه',
      clear: 'مسح',
      clearAriaLabel: 'مسح سجل التراجع',
    },
  },

  // ── ApiDocs page ──────────────────────────────────────────────────────────
  apiDocs: {
    title: 'وثائق API',
    subtitle: 'نقاط نهاية REST وWebSocket التي يكشفها Stellar Unified Price Oracle Aggregator.',
    openSpec: 'فتح مواصفة OpenAPI',
    baseUrl: 'عنوان URL الأساسي:',
    ws: 'WS:',
    tryItOut: 'جرّب',
    sending: 'جارٍ الإرسال…',
    copy: 'نسخ',
    copied: 'تم النسخ!',
  },

  // ── Source descriptions ───────────────────────────────────────────────────
  sources: {
    chainlink: 'Chainlink شبكة أوراكل لامركزية تقدم بيانات أسعار محمية من التلاعب من موفري بيانات متميزين.',
    redstone: 'RedStone أوراكل معياري يبث تغذيات أسعار موقّعة عند الطلب، مما يقلل تكاليف الغاز بتخزين البيانات خارج السلسلة.',
    band: 'Band Protocol يجمع البيانات الواقعية من مصادر متعددة ويتيحها على السلسلة عبر مدققين مفوّضين.',
    reflector: 'Reflector أوراكل أصلي لشبكة Stellar ينشر أسعار الأصول مباشرةً على شبكة Stellar.',
    defaultTooltip: '{{source}} ساهم بتغذية سعر لهذه القيمة المجمّعة.',
  },

  // ── Landing / Hero ────────────────────────────────────────────────────────
  landing: {
    hero: {
      ariaLabel: 'قسم نظرة عامة على السوق',
      liveStatus: 'مباشر · جميع الأوراكل نشطة',
      title: 'Stellar Unified Price Oracle',
      subtitle: 'أسعار أصول مجمّعة في الوقت الفعلي من Chainlink وRedstone وBand وReflector — تُبثّ مباشرةً لتطبيقك عبر REST وWebSocket.',
      cta: 'فتح لوحة التحكم',
      ctaAriaLabel: 'فتح لوحة تحكم أوراكل الأسعار',
      apiDocs: 'وثائق API',
    },
    stats: {
      totalPairs: 'الأزواج المتتبَّعة',
      totalPairsDetail: 'أزواج أصول مراقَبة',
      activeSources: 'مصادر الأوراكل',
      activeSourcesDetail: 'موفرو بيانات نشطون',
      avgConfidence: 'متوسط الثقة',
      avgConfidenceDetail: 'عبر جميع الأزواج',
      highConfidence: 'ثقة عالية',
      highConfidenceDetail: 'أزواج فوق ٩٠٪',
    },
    topPairs: {
      title: 'أعلى الأزواج ثقةً',
      pairAriaLabel: 'عرض تفاصيل السعر لـ {{pair}}',
      sources: 'مصادر',
      confidence: 'الثقة.',
    },
    powered: {
      label: 'مدعوم من',
    },
  },

  // ── Drag-and-drop reordering ──────────────────────────────────────────────
  draggableGrid: {
    dragHint: 'اسحب لإعادة الترتيب',
    ariaLabel: 'اسحب لإعادة ترتيب بطاقات الأسعار',
    dropTarget: 'أسقط هنا',
  },
} as const

export default ar
