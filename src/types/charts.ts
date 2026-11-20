export type QualityFlag = 'stale' | 'synthetic' | 'imputed';

export const ROLLING_STAT_KEYS = ['median', 'range'] as const;

export type RollingStatKey = (typeof ROLLING_STAT_KEYS)[number];

export interface Style {
  color: string;
  dash?: string;
  opacity?: number;
}

export type QualityFlagStyles = Record<QualityFlag, Style>;
