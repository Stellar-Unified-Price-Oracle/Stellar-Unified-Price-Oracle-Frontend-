import type { Preview } from '@storybook/react'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#111827' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    docs: {
      theme: undefined,
    },
  },
}

export default preview
