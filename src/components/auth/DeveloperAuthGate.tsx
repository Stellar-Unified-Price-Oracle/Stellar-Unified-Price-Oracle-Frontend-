import { type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';

interface DeveloperAuthGateProps {
  requiredScope: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function DeveloperAuthGate({
  requiredScope,
  children,
  fallback = null,
}: DeveloperAuthGateProps) {
  const { user, scopes } = useAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  const grantedScopes = scopes ?? user.scopes ?? [];

  if (!grantedScopes.includes(requiredScope)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
