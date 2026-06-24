import type { Meta, StoryObj } from '@storybook/react'
import { PriceCard } from './PriceCard'
import { PriceCardSkeleton } from './PriceCardSkeleton'
import type { PriceData } from '../types'

const mockPrice: PriceData = {
  assetPair: 'XLM/USD',
  price: 0.1234,
  timestamp: Date.now() - 5000,
  confidence: 0.97,
  sources: ['chainlink', 'redstone', 'band', 'reflector'],
}

const meta = {
  title: 'Components/PriceCard',
  component: PriceCard,
  tags: ['autodocs'],
  args: {
    price: mockPrice,
  },
} satisfies Meta<typeof PriceCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Stale: Story = {
  args: {
    isStale: true,
  },
}

export const WithAlert: Story = {
  args: {
    hasAlert: true,
  },
}

export const Selected: Story = {
  args: {
    selectMode: true,
    isSelected: true,
  },
}

export const DragOver: Story = {
  args: {
    isDragOver: true,
  },
}

export const Loading: Story = {
  render: () => <PriceCardSkeleton />,
}
