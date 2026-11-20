export type DashboardDensity = 'comfortable' | 'compact';

export type ExplanationReappearPolicy = 'always' | 'session' | 'never';

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: boolean;
  emailDigest: boolean;
  explanationReappearPolicy: ExplanationReappearPolicy;
  density: DashboardDensity;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  language: 'en',
  notifications: true,
  emailDigest: false,
  explanationReappearPolicy: 'session',
  density: 'comfortable',
};

export type PortablePreferences = Preferences;
