import type { Preview } from '@storybook/react';
import { withThemeByClassName } from '@storybook/addon-themes';
import { userEvent, within } from '@storybook/test';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      disable: true,
    },
    a11y: {
      test: 'todo',
    },
    // Interaction coverage for critical states (loading, empty, stale/unavailable, error)
    // is authored as play functions on the relevant stories. These defaults keep
    // keyboard and screen-reader assertions consistent across those tests.
    interactions: {
      // Fail the interaction test if a play function throws or an assertion fails.
      disable: false,
    },
  },
  globalTypes: {
    locale: {
      description: 'Active locale for visual regression coverage',
      defaultValue: 'en',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'es', title: 'Español' },
          { value: 'fr', title: 'Français' },
          { value: 'de', title: 'Deutsch' },
          { value: 'pt', title: 'Português' },
          { value: 'ja', title: '日本語' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    locale: 'en',
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
    (Story, context) => {
      const locale = (context.globals.locale as string) ?? 'en';
      return (
        <div lang={locale} data-locale={locale} className="min-h-screen bg-background text-foreground">
          <Story />
        </div>
      );
    },
  ],
  // Shared interaction helpers so critical-state stories can assert keyboard and
  // screen-reader behavior without duplicating setup. Stories opt in via play functions.
  loaders: [
    async () => ({
      // Expose a stable user-event instance for keyboard interaction tests.
      userEvent: userEvent.setup(),
    }),
  ],
};

export default preview;
