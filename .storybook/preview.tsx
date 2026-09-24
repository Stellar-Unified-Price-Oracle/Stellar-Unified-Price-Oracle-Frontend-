import type { Preview } from '@storybook/react-vite'
import { withThemeByClassName } from '@storybook/addon-themes'
import { MemoryRouter } from 'react-router-dom'
import { PreferencesProvider } from '../src/preferences/PreferencesContext'
import '../src/i18n'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    viewport: {
      options: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1440px', height: '900px' } },
      },
    },
    a11y: { test: 'todo' },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: 'light', dark: 'dark' },
      defaultTheme: 'dark',
    }),
    (Story) => (
      <MemoryRouter>
        <PreferencesProvider>
          <div className="bg-white dark:bg-gray-950 min-h-screen p-6">
            <Story />
          </div>
        </PreferencesProvider>
      </MemoryRouter>
    ),
  ],
}

export default preview
