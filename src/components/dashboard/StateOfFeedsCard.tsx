import React, { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeedSelectors } from '../../hooks/useFeedSelectors';
import type { FeedMover, DegradedSource, FeedAlert } from '../../types/feeds';

interface StateOfFeedsCardProps {
  /** Optional override for the "today" window used to filter alerts. */
  now?: Date;
  className?: string;
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatRelative(iso: string | undefined, now: Date): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = now.getTime() - then;
  if (diff < 60_000) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const StateOfFeedsCard: React.FC<StateOfFeedsCardProps> = ({
  now,
  className,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const referenceNow = useMemo(() => now ?? new Date(), [now]);

  const {
    biggestMovers,
    degradedSources,
    alerts,
    lastUpdated,
    isLoading,
  } = useFeedSelectors();

  const alertsToday = useMemo<FeedAlert[]>(() => {
    if (!alerts) return [];
    return alerts.filter((alert) => {
      const firedAt = new Date(alert.firedAt);
      return !Number.isNaN(firedAt.getTime()) && isSameDay(firedAt, referenceNow);
    });
  }, [alerts, referenceNow]);

  const isStale = useMemo(() => {
    if (!lastUpdated) return false;
    const updated = new Date(lastUpdated).getTime();
    if (Number.isNaN(updated)) return false;
    return referenceNow.getTime() - updated > STALE_THRESHOLD_MS;
  }, [lastUpdated, referenceNow]);

  const movers: FeedMover[] = biggestMovers ?? [];
  const degraded: DegradedSource[] = degradedSources ?? [];
  const isEmpty =
    !isLoading &&
    movers.length === 0 &&
    degraded.length === 0 &&
    alertsToday.length === 0;

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  return (
    <section
      className={className}
      aria-labelledby={`${contentId}-heading`}
      data-testid="state-of-feeds-card"
    >
      <h2 id={`${contentId}-heading`} className="sr-only">
        {t('dashboard.stateOfFeeds.title', "State of the feeds")}
      </h2>
      <button
        type="button"
        className="state-of-feeds__toggle"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={toggle}
        onKeyDown={onKeyDown}
        data-testid="state-of-feeds-toggle"
      >
        <span className="state-of-feeds__toggle-label">
          {t('dashboard.stateOfFeeds.title', "State of the feeds")}
        </span>
        {isStale && (
          <span className="state-of-feeds__stale-badge" role="status">
            {t('dashboard.stateOfFeeds.stale', "Stale")}
          </span>
        )}
        <span aria-hidden="true" className="state-of-feeds__chevron">
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      <div id={contentId} hidden={!expanded} data-testid="state-of-feeds-content">
        {isLoading ? (
          <div
            className="state-of-feeds__loading"
            role="status"
            aria-live="polite"
            data-testid="state-of-feeds-loading"
          >
            {t('dashboard.stateOfFeeds.loading', "Loading feed summary\u2026")}
          </div>
        ) : isEmpty ? (
          <div
            className="state-of-feeds__empty"
            role="status"
            aria-live="polite"
            data-testid="state-of-feeds-empty"
          >
            {t('dashboard.stateOfFeeds.empty', "No feed activity today.")}
          </div>
        ) : (
          <div className="state-of-feeds__body">
            {isStale && (
              <p className="state-of-feeds__stale-note" role="status">
                {t(
                  'dashboard.stateOfFeeds.staleNote',
                  'Data may be out of date. Last updated {{when}}.',
                  { when: formatRelative(lastUpdated, referenceNow) },
                )}
              </p>
            )}

            <div className="state-of-feeds__section" data-testid="state-of-feeds-movers">
              <h3>{t('dashboard.stateOfFeeds.movers', "Biggest movers")}</h3>
              {movers.length === 0 ? (
                <p>{t('dashboard.stateOfFeeds.noMovers', "No movers today.")}</p>
              ) : (
                <ul>
                  {movers.map((mover) => (
                    <li key={mover.id}>
                      <span>{mover.name}</span>{' '}
                      <span className={mover.delta >= 0 ? 'positive' : 'negative'}>
                        {mover.delta >= 0 ? '+' : ''}
                        {mover.delta}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="state-of-feeds__section" data-testid="state-of-feeds-degraded">
              <h3>{t('dashboard.stateOfFeeds.degraded', "Degraded sources")}</h3>
              {degraded.length === 0 ? (
                <p>{t('dashboard.stateOfFeeds.noDegraded', "All sources healthy.")}</p>
              ) : (
                <ul>
                  {degraded.map((source) => (
                    <li key={source.id}>
                      <span>{source.name}</span>{' '}
                      <span className="state-of-feeds__degraded-reason">
                        {source.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="state-of-feeds__section" data-testid="state-of-feeds-alerts">
              <h3>{t('dashboard.stateOfFeeds.alerts', "Alerts fired today")}</h3>
              {alertsToday.length === 0 ? (
                <p>{t('dashboard.stateOfFeeds.noAlerts', "No alerts fired today.")}</p>
              ) : (
                <ul>
                  {alertsToday.map((alert) => (
                    <li key={alert.id}>
                      <span>{alert.message}</span>{' '}
                      <time dateTime={alert.firedAt}>
                        {formatRelative(alert.firedAt, referenceNow)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default StateOfFeedsCard;
