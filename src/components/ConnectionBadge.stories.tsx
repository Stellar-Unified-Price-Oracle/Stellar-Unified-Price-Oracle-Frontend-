import type { Meta, StoryObj } from '@storybook/react-vite'
import { ConnectionBadge } from './ConnectionBadge'

const meta: Meta<typeof ConnectionBadge> = {
  title: 'Components/ConnectionBadge',
  component: ConnectionBadge,
}

export default meta
type Story = StoryObj<typeof ConnectionBadge>

export const Connected: Story = { args: { status: 'connected' } }
export const Connecting: Story = { args: { status: 'connecting' } }
export const Reconnecting: Story = {
  args: {
    status: 'reconnecting',
    diagnostics: { retryCount: 2, lastConnectedAt: Date.now() - 30_000, totalDisconnections: 1 },
  },
}
export const Waiting: Story = {
  args: {
    status: 'waiting',
    diagnostics: { retryCount: 4, lastConnectedAt: Date.now() - 90_000, totalDisconnections: 3 },
  },
}
export const Dead: Story = { args: { status: 'dead' } }
export const Offline: Story = { args: { status: 'disconnected' } }
