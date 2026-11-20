// Storage keys used throughout the app. All keys are namespaced with `supo:`
// so they can be identified and cleared together.
export const STORAGE_KEYS = {
  theme: 'supo:theme',
  language: 'supo:language',
  user: 'supo:user',
  authToken: 'supo:authToken',
  refreshToken: 'supo:refreshToken',
  notifications: 'supo:notifications',
  notificationConfig: 'supo:notificationConfig',
  preferences: 'supo:preferences',
  analyticsConsent: 'supo:analyticsConsent',
  dashboardFilters: 'supo:dashboardFilters',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Read a value from localStorage, parsing JSON when possible.
 */
export function getItem<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Write a value to localStorage, serializing to JSON.
 */
export function setItem<T>(key: StorageKey, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write failures (e.g. quota exceeded, private mode).
  }
}

/**
 * Remove a single key from localStorage.
 */
export function removeItem(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore removal failures.
  }
}

/**
 * Remove every registered key from localStorage.
 */
export function clearAllData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore removal failures.
    }
  });
}
