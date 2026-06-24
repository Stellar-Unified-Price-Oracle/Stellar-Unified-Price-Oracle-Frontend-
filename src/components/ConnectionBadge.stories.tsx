import type { Meta, StoryObj } from '@storybook/react'
import { ConnectionBadge } from './ConnectionBadge'

const meta = {
  title: 'Components/ConnectionBadge',
  component: ConnectionBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof ConnectionBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Connected: Story = {
  args: { status: 'connected' },
}

export const Connecting: Story = {
  args: { status: 'connecting' },
}

export const Reconnecting: Story = {
  args: { status: 'reconnecting' },
}

export const Disconnected: Story = {
  args: { status: 'disconnected' },
}

export const AuthFailed: Story = {
  args: { status: 'auth_failed' },
}
