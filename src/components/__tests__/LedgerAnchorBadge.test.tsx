import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LedgerAnchorBadge } from '../LedgerAnchorBadge';
import type { AnchorStatus, LedgerAnchor } from '../../../types/ledger';

function makeAnchor(overrides: Partial<LedgerAnchor> = {}): LedgerAnchor {
  return {
    id: 'anchor-1',
    ledger: 12345,
    hash: 'abc123def456',
    status: 'pending' as AnchorStatus,
    observedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    ...overrides,
  };
}

describe('LedgerAnchorBadge', () => {
  it('renders the pending status', () => {
    render(<LedgerAnchorBadge anchor={makeAnchor({ status: 'pending' })} />);
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it('renders the anchored status', () => {
    render(<LedgerAnchorBadge anchor={makeAnchor({ status: 'anchored' })} />);
    expect(screen.getByText(/anchored/i)).toBeInTheDocument();
  });

  it('renders the failed status', () => {
    render(<LedgerAnchorBadge anchor={makeAnchor({ status: 'failed' })} />);
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  it('shows the ledger number', () => {
    render(<LedgerAnchorBadge anchor={makeAnchor({ ledger: 98765 })} />);
    expect(screen.getByText(/98765/)).toBeInTheDocument();
  });
});
