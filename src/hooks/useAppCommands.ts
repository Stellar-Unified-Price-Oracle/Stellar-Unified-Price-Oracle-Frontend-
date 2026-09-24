/**
 * Registers commands that should be available on every page: navigation,
 * theme switching, and saved views.
 *
 * Page-scoped commands (price pairs, filters, exports) are registered by the
 * page that owns that state — see `useDashboardCommands`.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useRegisterCommands } from '../context/CommandRegistryContext'
import type { Command } from '../types/commands'
import { useSavedViews } from './useSavedViews'
import { useTheme } from './useTheme'

export function useAppCommands(): void {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { mode, setMode, toggle } = useTheme()
  const { views, activateView } = useSavedViews()

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      // ── Navigation ───────────────────────────────────────────────────────
      {
        id: 'nav:dashboard',
        label: t('nav.dashboard'),
        category: 'navigation',
        hint: '/dashboard',
        handler: () => navigate('/dashboard'),
      },
      {
        id: 'nav:home',
        label: t('nav.home'),
        category: 'navigation',
        hint: '/',
        handler: () => navigate('/'),
      },
      {
        id: 'nav:api-docs',
        label: t('nav.apiDocs'),
        category: 'navigation',
        hint: '/api-docs',
        handler: () => navigate('/api-docs'),
      },
      {
        id: 'nav:webhooks',
        label: t('commandPalette.nav.webhooks'),
        category: 'navigation',
        hint: '/webhooks',
        handler: () => navigate('/webhooks'),
      },
      {
        id: 'nav:security',
        label: t('commandPalette.nav.security'),
        category: 'navigation',
        hint: '/security',
        handler: () => navigate('/security'),
      },

      // ── Theme ────────────────────────────────────────────────────────────
      {
        id: 'theme:light',
        label: t('commandPalette.theme.light'),
        category: 'theme',
        enabled: mode !== 'light',
        handler: () => setMode('light'),
      },
      {
        id: 'theme:dark',
        label: t('commandPalette.theme.dark'),
        category: 'theme',
        enabled: mode !== 'dark',
        handler: () => setMode('dark'),
      },
      {
        id: 'theme:system',
        label: t('commandPalette.theme.system'),
        category: 'theme',
        enabled: mode !== 'system',
        handler: () => setMode('system'),
      },
      {
        id: 'theme:toggle',
        label: t('commandPalette.theme.toggle'),
        category: 'theme',
        handler: toggle,
      },
    ]

    // ── Saved views ────────────────────────────────────────────────────────
    for (const view of views) {
      list.push({
        id: `view:${view.id}`,
        label: view.name,
        category: 'savedViews',
        hint: view.description,
        handler: () => activateView(view.id),
      })
    }

    return list
  }, [navigate, t, mode, setMode, toggle, views, activateView])

  useRegisterCommands(commands)
}
