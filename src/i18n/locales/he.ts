/**
 * Hebrew (he) locale — placeholder translations for RTL layout testing.
 *
 * All strings are placeholders that mirror the English originals so the app
 * remains fully usable while the UI is exercised in an RTL context.
 * Replace the values here with properly reviewed Hebrew copy before shipping.
 */
const he = {
  // ── Layout ──────────────────────────────────────────────────────────────
  nav: {
    home: 'בית',
    dashboard: 'לוח בקרה',
    apiDocs: 'תיעוד API',
    toggleMenu: 'פתח/סגור תפריט',
    toggleAlerts: 'פתח/סגור התראות מחיר',
    appName: 'Stellar Oracle',
  },
  footer: {
    text: 'Stellar Unified Price Oracle · פורטל מפתחים ולוח אנליטיקה',
    securityLink: 'אבטחה',
  },

  // ── Dashboard page ───────────────────────────────────────────────────────
  dashboard: {
    title: 'לוח בקרה — Oracle מחירים',
    subtitle: 'מצטבר מ‑Chainlink, Redstone, Band ו‑Reflector',
    search: {
      placeholder: 'חפש לפי זוג נכסים...',
      ariaLabel: 'חפש לפי זוג נכסים',
    },
    filter: {
      toggle: 'סינון',
      ariaLabel: 'פתח/סגור פאנל סינון',
    },
    select: {
      button: 'בחר',
      buttonWithCount: 'בחר ({{count}})',
      buttonShort: 'בחר',
      ariaLabel: 'פתח/סגור מצב בחירה',
    },
    viewToggle: {
      ariaLabel: 'החלפת תצוגה',
      card: 'תצוגת כרטיסים',
      table: 'תצוגת טבלה',
    },
    alerts: {
      ariaLabel: 'הגדר ערוצי התראות',
      title: 'התראות',
    },
    selection: {
      count: '{{count}} נבחרו',
      selectAll: 'בחר הכל',
      deselectAll: 'בטל בחירת הכל',
      exportCsv: 'ייצא CSV',
    },
    emptyState: {
      noFeeds: 'אין עדכוני מחיר זמינים',
      noFeedsDetail: 'התחבר ל-aggregator API לצפייה בנתוני מחיר.',
      noResults: 'אין תוצאות',
      noResultsSearch: 'אין תוצאות עבור "{{search}}"',
      noResultsFilterHint: 'נסה לשנות את הסינון.',
      noResultsSearchHint: 'נסה מונח חיפוש שונה.',
    },
    loadingAriaLabel: 'טוען כרטיסי מחיר',
    feedsAriaLabel: 'עדכוני מחיר',
    pullToRefresh: {
      pull: 'משוך מטה לרענון',
      release: 'שחרר לרענון',
      refreshing: 'מרענן…',
    },
  },

  // ── FilterPanel ──────────────────────────────────────────────────────────
  filter: {
    title: 'סינון ומיון',
    clearAll: 'נקה הכל ({{count}})',
    sources: 'מקורות Oracle',
    lastUpdated: 'עדכון אחרון',
    confidence: 'ביטחון: {{min}}%–{{max}}%',
    confidenceMin: 'מינ׳',
    confidenceMax: 'מקס׳',
    priceRange: 'טווח מחיר',
    priceMin: 'מינ׳',
    priceMax: 'מקס׳',
    sortBy: 'מיין לפי',
    sortDefault: 'ברירת מחדל',
    sortDirection: {
      ascending: 'עולה',
      descending: 'יורד',
      ariaLabel: 'כיוון מיון: {{direction}}',
    },
    updatedWithin: {
      all: 'כל הזמן',
      '1h': 'שעה',
      '6h': '٦ שעות',
      '24h': '24 שעות',
      '7d': '7 ימים',
    },
    sort: {
      pair: 'זוג (א–ת)',
      priceHigh: 'מחיר (גבוה → נמוך)',
      priceLow: 'מחיר (נמוך → גבוה)',
      confidence: 'ביטחון',
      recent: 'עדכון אחרון',
    },
    ariaLabels: {
      minConfidence: 'ביטחון מינימלי',
      maxConfidence: 'ביטחון מקסימלי',
      sortBy: 'מיין לפי',
      minPrice: 'מחיר מינימלי',
      maxPrice: 'מחיר מקסימלי',
    },
  },

  // ── PriceCard ────────────────────────────────────────────────────────────
  priceCard: {
    updated: 'עודכן {{time}}',
    confidence: 'ביטחון {{value}}%',
    alertSet: 'התראה מוגדרת',
    setAlert: 'הגדר התראה',
    ariaLabel: 'הצג פרטים עבור {{pair}}',
    alertAriaLabel: 'הגדר התראה עבור {{pair}}',
    confidenceTooltip:
      'הביטחון משקף עד כמה המחיר עקבי בין מקורות ה-Oracle. 100% אומר שכל המקורות מסכימים לחלוטין.',
  },

  // ── PriceTableView ────────────────────────────────────────────────────────
  table: {
    ariaLabel: 'טבלת עדכוני מחיר',
    columns: {
      pair: 'זוג',
      price: 'מחיר',
      confidence: 'ביטחון',
      sources: 'מקורות',
      updated: 'עודכן',
      alert: 'התראה',
      select: 'בחר',
    },
    row: {
      liveAriaLabel: 'נתונים חיים',
      alertAriaLabel: 'התראה פעילה',
      rowAriaLabel: 'הצג פרטים עבור {{pair}}',
      alertSet: 'התראה מוגדרת',
      setAlert: 'הגדר התראה',
      alertButtonAriaLabel: 'הגדר התראה עבור {{pair}}',
    },
  },

  // ── AlertModal ────────────────────────────────────────────────────────────
  alertModal: {
    titleNew: 'התראת מחיר חדשה',
    titleEdit: 'ערוך התראה',
    ariaLabelNew: 'צור התראת מחיר',
    ariaLabelEdit: 'ערוך התראת מחיר',
    close: 'סגור חלון',
    firedOnceNotice: 'התראה זו הופעלה ב‑{{time}} ({{count}} סה״כ). הפעל מחדש לשימוש חוזר.',
    fireCount: 'הופעל {{count}} פעם/פעמים',
    fields: {
      assetPair: 'זוג נכסים',
      assetPairPlaceholder: 'לדוג׳ BTC/USD',
      upperThreshold: 'סף עליון',
      upperPlaceholder: 'מחיר מקסימלי',
      lowerThreshold: 'סף תחתון',
      lowerPlaceholder: 'מחיר מינימלי',
      triggerOnce: 'הפעל פעם אחת',
      triggerOnceDescription: 'ההתראה מתבטלת אוטומטית לאחר הפעלה',
      alertMode: 'מצב התראה',
      alertModeAbsolute: 'מחיר מוחלט',
      alertModePercentage: 'תנועת מחיר %',
      percentageThreshold: 'סף שינוי',
      percentageWindow: 'חלון זמן',
      percentageDirection: 'כיוון',
      percentageRelativeTo: 'ביחס ל',
      window5min: '5 דקות',
      window15min: '15 דקות',
      window1hr: 'שעה',
      window24hr: '24 שעות',
      directionUp: '↑ עלייה',
      directionDown: '↓ ירידה',
      directionEither: '↕ שניהם',
      relativeToOpen: 'פתיחת תקופה',
      relativeToPreviousClose: 'סגירה קודמת',
      relativeToMovingAverage: 'ממוצע נע',
      alertType: 'סוג התראה',
      alertTypeOneTime: 'חד-פעמי',
      alertTypePersistent: 'מתמשך',
      alertTypeOneTimeDesc: 'מופעל פעם אחת ומתבטל אוטומטית. הפעל מחדש לשימוש חוזר.',
      alertTypePersistentDesc: 'מופעל בכל פעם שהתנאי מתקיים. עוקב אחר מספר ההפעלות.',
      cooldown: 'זמן קירור בין התראות',
      cooldownOff: 'כבוי (הפעלה מיידית)',
      cooldown1min: 'דקה',
      cooldown5min: '5 דקות',
      cooldown15min: '15 דקות',
      cooldown1hr: 'שעה',
      cooldownDesc: 'זמן מינימלי בין הפעלות חוזרות, למניעת הצפת התראות כשהמחיר מתנדנד סביב הסף שלך.',
    },
    actions: {
      delete: 'מחק התראה',
      cancel: 'בטל',
      save: 'שמור שינויים',
      create: 'צור התראה',
      reEnable: 'הפעל התראה מחדש',
    },
    validation: {
      assetPairRequired: 'זוג נכסים הוא שדה חובה',
      atLeastOneThreshold: 'נדרש לפחות סף אחד',
      mustBePositive: 'חייב להיות מספר חיובי',
      upperGreaterThanLower: 'חייב להיות גדול מהסף התחתון',
      lowerLessThanUpper: 'חייב להיות קטן מהסף העליון',
    },
    conditions: {
      title: 'תנאים נוספים',
      description: 'הוסף תנאים נוספים על גבי השדה שלמעלה, בשילוב AND/OR.',
      add: '+ הוסף תנאי',
      logicLabel: 'שילוב תנאים באמצעות',
      and: 'וגם',
      or: 'או',
      operatorLabel: 'אופרטור עבור תנאי {{index}}',
      valueLabel: 'ערך עבור תנאי {{index}}',
      windowLabel: 'חלון זמן עבור תנאי {{index}}',
      remove: 'הסר תנאי {{index}}',
      priceUnit: 'דולר',
      operator_gt: '>',
      operator_gte: '≥',
      operator_lt: '<',
      operator_lte: '≤',
      operator_eq: '=',
    },
    escalation: {
      enable: 'הפעל מדיניות אסקלציה',
      description: 'הודע לערוצים נוספים בעיכובים גדלים כל עוד ההפרה נמשכת.',
      addStep: '+ הוסף שלב',
      channelLabel: 'ערוץ עבור שלב {{step}}',
      delayLabel: 'עיכוב בדקות עבור שלב {{step}}',
      removeStep: 'הסר שלב {{step}}',
      minutesSuffix: 'דק\'',
      channel_inApp: 'בתוך האפליקציה',
      channel_email: 'אימייל',
      channel_webPush: 'התראת דחיפה',
      channel_webhook: 'Webhook',
      channel_telegram: 'טלגרם',
      channel_discord: 'דיסקורד',
      error_invalidDelay: 'שלב {{step}}: העיכוב חייב להיות מספר דקות שאינו שלילי',
      error_outOfOrder: 'שלב {{step}}: העיכוב לא יכול להיות מוקדם מהשלב הקודם',
    },
    presets: {
      title: 'התחל מתבנית',
      myPresets: 'התבניות שלי',
      deleteCustom: 'מחק תבנית {{name}}',
      nameLabel: 'שם התבנית',
      descriptionLabel: 'תיאור (אופציונלי)',
      save: 'שמור תבנית',
      saveCurrentAsPreset: '+ שמור את ההגדרות הנוכחיות כתבנית',
    },
  },

  // ── AlertPanel ────────────────────────────────────────────────────────────
  alertPanel: {
    title: 'התראות מחיר',
    newBadge: '{{count}} חדש',
    empty: 'טרם הוגדרו התראות',
    close: 'סגור פאנל התראות',
    sections: {
      triggered: 'הופעל',
      active: 'התראות פעילות',
      inactive: 'לא פעיל',
      snoozed: 'נדחה',
      firedOnce: 'הופעל (חד-פעמי)',
    },
    triggered: {
      justNow: 'עכשיו',
      priceCrossed: 'המחיר חצה',
      markRead: 'סמן כנקרא',
      delete: 'מחק',
    },
    active: {
      pause: 'השהה התראה',
      delete: 'מחק התראה',
    },
    inactive: {
      resume: 'חדש התראה',
      delete: 'מחק התראה',
    },
    snooze: {
      button: 'דחה',
      unsnooze: 'בטל דחייה',
      '15min': '15 דקות',
      '1hr': 'שעה',
      '4hr': '4 שעות',
      '24hr': '24 שעות',
      tomorrow: 'עד מחר (8 בבוקר)',
      expiresInMins: 'נדחה ל‑{{mins}} דקות',
      expiresInHrs: 'נדחה ל‑{{hrs}} שעות',
    },
    badge: {
      oneTime: 'חד-פעמי',
      persistent: 'מתמשך',
      snoozed: 'נדחה',
      fired: 'הופעל',
    },
    fired: {
      at: 'הופעל ב‑{{time}}',
      reEnable: 'הפעל התראה מחדש',
    },
    conditions: {
      between: 'בין ${{lower}} לבין ${{upper}}',
      above: '↑ מעל ${{upper}}',
      below: '↓ מתחת ל‑${{lower}}',
      none: 'אין סף',
      percentage: '{{direction}} {{pct}}% ב‑{{window}}',
      dir_up: '↑ עלייה',
      dir_down: '↓ ירידה',
      dir_either: '↕ שניהם',
    },
    tabs: {
      alerts: 'התראות',
      history: 'היסטוריה',
    },
    history: {
      empty: 'טרם הופעלו התראות',
      searchPlaceholder: 'חפש לפי זוג נכסים…',
      noResults: 'אין ערכי היסטוריה תואמים לחיפוש שלך',
      clear: 'נקה היסטוריה',
      clearConfirm: 'למחוק את כל היסטוריית ההתראות? לא ניתן לבטל פעולה זו.',
      exportCsv: 'ייצא CSV',
      exportJson: 'ייצא JSON',
      count_one: '{{count}} התראה שהופעלה',
      count_other: '{{count}} התראות שהופעלו',
      priceAt: 'מחיר: ${{price}}',
    },
    escalation: {
      label: 'אסקלציה:',
      progress: '{{fired}} מתוך {{total}} שלבים הופעלו',
      historyBadge: 'אסקלציה · {{channel}}',
    },
  },

  // ── Alert preset library (#486) ─────────────────────────────────────────
  alertPresets: {
    whaleMove: {
      name: 'תנועת לווייתן',
      description: 'תנודת מחיר גדולה בכל כיוון בתוך חלון זמן קצר.',
      useCase: 'זהה תנועות פתאומיות של מחזיק גדול לפני שהשוק הרחב מגיב.',
    },
    breakout: {
      name: 'פריצה',
      description: 'מומנטום מאושר בשני חלונות זמן: תנועה חזקה של שעה שממשיכה להאיץ ב-15 הדקות האחרונות.',
      useCase: 'זהה תנועה שהיא יותר מרעש — המגמה מאושרת, לא רק מתחילה.',
    },
    pegBreak: {
      name: 'שבירת עיגון של מטבע יציב',
      description: 'המחיר סוטה ביותר מ-1% מהעיגון שלו ל-1.00$ בכל כיוון.',
      useCase: 'קבל התראה מוקדמת אם מטבע יציב שאתה מחזיק מאבד את העיגון שלו.',
    },
  },

  // ── ConnectionBadge ───────────────────────────────────────────────────────
  connection: {
    live: 'חי',
    connecting: 'מתחבר',
    reconnecting: 'מתחבר מחדש',
    offline: 'לא מחובר',
    rateLimited: 'מוגבל קצב',
    rateLimitedWithTimer: 'מוגבל קצב ({{seconds}}ש׳)',
    ariaLabel: 'WebSocket {{status}}',
    rateLimitedAriaLabel: 'API מוגבל קצב',
    tooltips: {
      connected: 'WebSocket מחובר. עדכוני מחיר מוזרמים בזמן אמת.',
      connecting: 'מקים חיבור WebSocket לשרת עדכוני המחיר.',
      reconnecting: 'חיבור ה-WebSocket נותק. מנסה להתחבר מחדש אוטומטית.',
      disconnected: 'WebSocket לא מחובר. מחירים מתעדכנים דרך REST polling בלבד.',
      rateLimited: 'ה-API מוגבל קצב זמנית. הבקשות יתחדשו לאחר שחלון ההמתנה יפקע.',
    },
  },

  // ── ErrorBoundary ─────────────────────────────────────────────────────────
  error: {
    title: 'משהו השתבש',
    defaultMessage: 'אירעה שגיאה בלתי צפויה.',
    reload: 'טען מחדש',
  },

  // ── NetworkStatusBanner ───────────────────────────────────────────────────
  network: {
    offline: 'אין חיבור לאינטרנט',
    offlineDetail: 'הנתונים עשויים להיות ישנים עד שתתחבר מחדש',
  },

  // ── NotFound page ─────────────────────────────────────────────────────────
  notFound: {
    heading: '404',
    message: 'הדף לא נמצא',
    backToDashboard: 'חזור ללוח הבקרה',
  },

  // ── PriceDetail page ──────────────────────────────────────────────────────
  priceDetail: {
    back: 'חזור',
    backAriaLabel: 'חזור ללוח הבקרה',
    sections: {
      currentPrice: 'מחיר נוכחי',
      oracleSources: 'מקורות Oracle',
      priceHistory: 'היסטוריית מחירים (עמודים)',
      importData: 'ייבא נתוני מחיר',
    },
    live: 'חי',
    confidence: 'ביטחון {{value}}%',
    updated: 'עודכן {{time}}',
    historyError: 'טעינת היסטוריית מחירים נכשלה: {{message}}',
    emptyState: {
      title: 'אין נתוני מחיר זמינים',
      detail: 'אין נתוני מחיר זמינים עבור זוג זה.',
    },
  },

  // ── CsvImportZone ─────────────────────────────────────────────────────────
  csv: {
    imported: 'נתוני CSV יובאו — מוצגים כשכבה על הגרף',
    clear: 'נקה',
    dropOrBrowse: 'שחרר קובץ CSV או',
    browse: 'עיין',
    hint: 'עמודות: timestamp, price — עד 5 MB',
    uploadAriaLabel: 'העלה קובץ CSV לייבוא נתוני מחיר',
    errors: {
      tooLarge: 'הקובץ עולה על מגבלת 5MB',
      invalidType: 'רק קבצי CSV נתמכים',
      empty: 'הקובץ ריק',
      noValidRows: 'לא נמצאו שורות תקינות. עמודות צפויות: timestamp, price',
    },
  },

  // ── ExportButton ──────────────────────────────────────────────────────────
  export: {
    button: 'ייצא',
    ariaLabel: 'ייצא נתונים',
    exportAs: 'ייצא כ‑{{format}}',
    langSelector: 'שפת קטע קוד',
    columns: {
      button: 'עמודות',
      title: 'בחר עמודות לייצוא',
      preset: {
        minimal: 'מינימלי',
        standard: 'סטנדרטי',
        full: 'מלא',
      },
      search: 'סנן עמודות…',
      available: 'זמין',
      noMatches: 'אין עמודות תואמות',
      selectedOrder: 'נבחר (גרור לסידור מחדש)',
      preview: 'תצוגה מקדימה',
    },
  },

  // ── SettingsPanel ─────────────────────────────────────────────────────────
  settings: {
    title: 'הגדרות',
    close: 'סגור הגדרות',
    sections: {
      data: 'נתונים',
      accessibility: 'נגישות',
      privacy: 'פרטיות',
      language: 'שפה',
    },
    fields: {
      refreshInterval: 'מרווח רענון',
      chartTimeRange: 'טווח זמן גרף',
      staleThreshold: 'סף נכסים ישנים',
    },
    accessibility: {
      reducedMotion: 'הפחת תנועה',
      reducedMotionDesc: 'מבטל אנימציות ומעברים למשתמשים הרגישים לתנועה',
      highContrast: 'ניגודיות גבוהה',
      highContrastDesc: 'מגדיל יחסי ניגודיות צבע למשתמשים עם לקויות ראייה',
      largeText: 'טקסט גדול',
      largeTextDesc: 'מגדיל את גודל הגופן הבסיסי בלוח הבקרה',
    },
    privacy: {
      enableAnalytics: 'הפעל אנליטיקה',
      enableAnalyticsDesc: 'אפשר אנליטיקה ממוקדת פרטיות לשימוש בתכונות (ניתן לביטול).',
    },
    language: {
      label: 'שפת ממשק',
      rtlOverride: 'כפה פריסת RTL',
      rtlOverrideDesc: 'עקוף את הכיוון ל-RTL לבדיקה ללא שינוי שפה',
    },
    actions: {
      undo: 'בטל',
      undoShortcut: 'Ctrl+Z',
      undoAriaLabel: 'בטל שינוי אחרון',
      redo: 'חזור',
      redoShortcut: 'Ctrl+Shift+Z',
      redoAriaLabel: 'חזור על שינוי שבוטל',
      clear: 'נקה',
      clearAriaLabel: 'נקה היסטוריית ביטול',
    },
  },

  // ── ApiDocs page ──────────────────────────────────────────────────────────
  apiDocs: {
    title: 'תיעוד API',
    subtitle: 'נקודות קצה REST ו-WebSocket הנחשפות על ידי Stellar Unified Price Oracle Aggregator.',
    openSpec: 'פתח מפרט OpenAPI',
    baseUrl: 'URL בסיס:',
    ws: 'WS:',
    tryItOut: 'נסה',
    sending: 'שולח…',
    copy: 'העתק',
    copied: 'הועתק!',
  },

  // ── Source descriptions ───────────────────────────────────────────────────
  sources: {
    chainlink: 'Chainlink היא רשת Oracle מבוזרת המספקת נתוני מחיר עמידים בפני חבלה ממספקי נתונים פרמיום.',
    redstone: 'RedStone הוא Oracle מודולרי שמזרים עדכוני מחיר חתומים לפי דרישה, ומפחית עלויות גז על ידי אחסון נתונים מחוץ לשרשרת.',
    band: 'Band Protocol מצבר נתוני עולם אמיתי ממקורות מרובים ומאפשר אותם על-שרשרת דרך מאמתים מוסמכים.',
    reflector: 'Reflector הוא Oracle ילידי Stellar המפרסם מחירי נכסים ישירות על רשת Stellar.',
    defaultTooltip: '{{source}} תרם עדכון מחיר לערך המצטבר הזה.',
  },

  // ── Landing / Hero ────────────────────────────────────────────────────────
  landing: {
    hero: {
      ariaLabel: 'חלק סקירה כללית של השוק',
      liveStatus: 'חי · כל ה-Oracles פעילים',
      title: 'Stellar Unified Price Oracle',
      subtitle: 'מחירי נכסים מצטברים בזמן אמת מ-Chainlink, Redstone, Band ו-Reflector — מוזרמים ישירות לאפליקציה שלך דרך REST ו-WebSocket.',
      cta: 'פתח לוח בקרה',
      ctaAriaLabel: 'פתח את לוח בקרת Oracle המחירים',
      apiDocs: 'תיעוד API',
    },
    stats: {
      totalPairs: 'זוגות מעוקבים',
      totalPairsDetail: 'זוגות נכסים במעקב',
      activeSources: 'מקורות Oracle',
      activeSourcesDetail: 'ספקי נתונים פעילים',
      avgConfidence: 'ביטחון ממוצע',
      avgConfidenceDetail: 'על פני כל הזוגות',
      highConfidence: 'ביטחון גבוה',
      highConfidenceDetail: 'זוגות מעל 90%',
    },
    topPairs: {
      title: 'זוגות מובילים לפי ביטחון',
      pairAriaLabel: 'הצג פרטי מחיר עבור {{pair}}',
      sources: 'מקורות',
      confidence: 'ביטחון.',
    },
    powered: {
      label: 'מופעל על ידי',
    },
  },

  // ── Drag-and-drop reordering ──────────────────────────────────────────────
  draggableGrid: {
    dragHint: 'גרור לסידור מחדש',
    ariaLabel: 'גרור לסידור מחדש של כרטיסי מחיר',
    dropTarget: 'שחרר כאן',
  },
} as const

export default he
