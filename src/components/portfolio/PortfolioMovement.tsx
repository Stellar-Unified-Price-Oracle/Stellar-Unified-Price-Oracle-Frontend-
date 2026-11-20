import { useMemo } from 'react';
import type { PortfolioMovement as PortfolioMovementData } from '../../types/portfolio';

interface PortfolioMovementProps {
  movement: PortfolioMovementData | null;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function PortfolioMovement({ movement }: PortfolioMovementProps) {
  const rows = useMemo(() => {
    if (!movement) return [];
    return movement.breakdown ?? [];
  }, [movement]);

  if (!movement) {
    return (
      <section
        className="portfolio-movement portfolio-movement--empty"
        aria-label="Portfolio movement"
        data-testid="portfolio-movement-empty"
      >
        <h2 className="portfolio-movement__title">Portfolio Movement</h2>
        <p className="portfolio-movement__empty-message">
          Movement unavailable. There are no holdings or prices are stale.
        </p>
      </section>
    );
  }

  const isPositive = movement.change >= 0;

  return (
    <section className="portfolio-movement" aria-label="Portfolio movement">
      <h2 className="portfolio-movement__title">Portfolio Movement</h2>
      <div className="portfolio-movement__summary">
        <span className="portfolio-movement__value">
          {formatCurrency(movement.change)}
        </span>
        <span
          className={`portfolio-movement__percent ${
            isPositive ? 'is-positive' : 'is-negative'
          }`}
        >
          {formatPercent(movement.changePercent)}
        </span>
      </div>
      {rows.length > 0 ? (
        <ul className="portfolio-movement__breakdown">
          {rows.map((row) => (
            <li key={row.asset} className="portfolio-movement__row">
              <span className="portfolio-movement__asset">{row.asset}</span>
              <span className="portfolio-movement__amount">
                {formatCurrency(row.change)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="portfolio-movement__empty-message">
          No movement breakdown available.
        </p>
      )}
    </section>
  );
}
