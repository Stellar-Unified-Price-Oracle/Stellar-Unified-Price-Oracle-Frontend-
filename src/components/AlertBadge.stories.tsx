import type { Meta, StoryObj } from '@storybook/react'
import { AlertBadge } from './AlertBadge'
import type { Alert } from '../types'

const baseAlert: Alert = {
  id: '1',
  assetPair: 'XLM/USD',
  upperThreshold: 0.15,
  lowerThreshold: 0.10,
  triggerOnce: false,
  active: true,
  createdAt: Date.now(),
  lastTriggeredAt: null,
}

const meta = {
  title: 'Components/AlertBadge',
  component: AlertBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof AlertBadge>

export default meta
type Story = StoryObj<typeof meta>

export const SingleAlert: Story = {
  args: {
    count: 1,
    alerts: [baseAlert],
  },
}

export const MultipleAlerts: Story = {
  args: {
    count: 3,
    alerts: [
      baseAlert,
      { ...baseAlert, id: '2', assetPair: 'BTC/USD', upperThreshold: 70000, lowerThreshold: 60000 },
      { ...baseAlert, id: '3', assetPair: 'ETH/USD', upperThreshold: 3500, lowerThreshold: 3000 },
    ],
  },
}

export const UpperOnly: Story = {
  args: {
    count: 1,
    alerts: [{ ...baseAlert, lowerThreshold: null }],
  },
}

export const LowerOnly: Story = {
  args: {
    count: 1,
    alerts: [{ ...baseAlert, upperThreshold: null }],
  },
}
