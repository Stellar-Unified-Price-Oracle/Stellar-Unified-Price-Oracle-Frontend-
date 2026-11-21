// Lightweight, SSR-safe storage helpers used across the app.
// All access is guarded so this module is safe to import on the server.

const isBrowser = typeof window !== 'undefined';

export function getItem<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / serialization errors.
  }
}

export function removeItem(key: string): void {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

// ---------------------------------------------------------------------------
// Onboarding checklist (#1022)
// ---------------------------------------------------------------------------

export type OnboardingStep =
  | 'pick-pairs'
  | 'create-alert'
  | 'connect-channel'
  | 'try-export';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'pick-pairs',
  'create-alert',
  'connect-channel',
  'try-export',
];

export interface OnboardingState {
  completed: OnboardingStep[];
  dismissed: boolean;
}

const ONBOARDING_KEY = 'onboarding-checklist';

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  completed: [],
  dismissed: false,
};

export function getOnboardingState(): OnboardingState {
  const stored = getItem<Partial<OnboardingState>>(
    ONBOARDING_KEY,
    DEFAULT_ONBOARDING_STATE,
  );
  return {
    completed: Array.isArray(stored.completed) ? stored.completed : [],
    dismissed: Boolean(stored.dismissed),
  };
}

export function setOnboardingState(state: OnboardingState): void {
  setItem(ONBOARDING_KEY, state);
}

export function completeOnboardingStep(step: OnboardingStep): OnboardingState {
  const current = getOnboardingState();
  const completed = current.completed.includes(step)
    ? current.completed
    : [...current.completed, step];
  const next: OnboardingState = {
    completed,
    // Auto-dismiss once every step is done so the checklist stays gone.
    dismissed:
      current.dismissed || ONBOARDING_STEPS.every((s) => completed.includes(s)),
  };
  setOnboardingState(next);
  return next;
}

export function dismissOnboarding(): OnboardingState {
  const current = getOnboardingState();
  const next: OnboardingState = { ...current, dismissed: true };
  setOnboardingState(next);
  return next;
}

export function resetOnboarding(): OnboardingState {
  setOnboardingState(DEFAULT_ONBOARDING_STATE);
  return DEFAULT_ONBOARDING_STATE;
}
