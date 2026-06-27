import type { Meta, StoryObj } from '@storybook/react'
import { ErrorBoundary } from './ErrorBoundary'

const meta: Meta<typeof ErrorBoundary> = {
  component: ErrorBoundary,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof ErrorBoundary>

function Bomb(): never {
  throw new Error('Simulated render error')
}

export const Default: Story = {
  args: { children: <p className="text-gray-300">No error — children render normally.</p> },
}

export const ErrorState: Story = {
  args: { children: <Bomb /> },
}

export const CustomFallback: Story = {
  args: {
    children: <Bomb />,
    fallback: (
      <div className="p-6 text-center text-red-400 font-medium">
        Custom fallback UI — something went wrong.
      </div>
    ),
  },
}
