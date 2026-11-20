import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeveloperAuthGate } from './DeveloperAuthGate';
import type { AuthContextValue } from '../../auth/AuthContext';

const mockUseAuth = vi.fn<[], AuthContextValue>();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

function buildAuthValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    scopes: [],
    isLoading: false,
    isAuthenticated: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  } as AuthContextValue;
}

describe('DeveloperAuthGate', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('denies a user who lacks the required scope', () => {
    mockUseAuth.mockReturnValue(
      buildAuthValue({
        user: {
          id: 'user-1',
          email: 'dev@example.com',
          scopes: ['read:profile'],
        } as AuthContextValue['user'],
        scopes: ['read:profile'],
        isAuthenticated: true,
      }),
    );

    render(
      <DeveloperAuthGate requiredScope="developer:admin">
        <div>secret developer area</div>
      </DeveloperAuthGate>,
    );

    expect(screen.queryByText('secret developer area')).not.toBeInTheDocument();
  });

  it('allows a user who has the required scope', () => {
    mockUseAuth.mockReturnValue(
      buildAuthValue({
        user: {
          id: 'user-2',
          email: 'admin@example.com',
          scopes: ['developer:admin'],
        } as AuthContextValue['user'],
        scopes: ['developer:admin'],
        isAuthenticated: true,
      }),
    );

    render(
      <DeveloperAuthGate requiredScope="developer:admin">
        <div>secret developer area</div>
      </DeveloperAuthGate>,
    );

    expect(screen.getByText('secret developer area')).toBeInTheDocument();
  });
});
