import type { Meta, StoryObj } from '@storybook/react'
import { AlertBadge } from './AlertBadge'
import type { Alert } from '../types'

const meta: Meta<typeof AlertBadge> = {
  component: AlertBadge,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof AlertBadge>

const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: '1',
  assetPair: 'XLM/USD',
  upperThreshold: 0.15,
  lowerThreshold: 0.10,
  triggerOnce: false,
  active: true,
  createdAt: Date.now(),
  lastTriggeredAt: null,
  ...overrides,
})

export const UpperAndLower: Story = {
  args: { count: 2, alerts: [makeAlert(), makeAlert({ id: '2' })] },
}

export const UpperOnly: Story = {
  args: { count: 1, alerts: [makeAlert({ lowerThreshold: null })] },
}

export const LowerOnly: Story = {
  args: { count: 1, alerts: [makeAlert({ upperThreshold: null })] },
}

export const Empty: Story = {
  args: { count: 0, alerts: [] },
}
