import type { Meta, StoryObj } from '@storybook/react'
import { ConnectionBadge } from './ConnectionBadge'

const meta: Meta<typeof ConnectionBadge> = {
  title: 'Components/ConnectionBadge',
  component: ConnectionBadge,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof ConnectionBadge>

export const Connected: Story = { args: { status: 'connected' } }
export const Connecting: Story = { args: { status: 'connecting' } }
export const Reconnecting: Story = { args: { status: 'reconnecting' } }
export const Disconnected: Story = { args: { status: 'disconnected' } }
