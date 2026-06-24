import type { Preview } from '@storybook/react'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#030712' },
        { name: 'light', value: '#ffffff' },
      ],
    },
    layout: 'centered',
  },
}

export default preview
