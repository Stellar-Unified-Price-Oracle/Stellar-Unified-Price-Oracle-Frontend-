import type { Meta, StoryObj } from '@storybook/react'
import { PriceCard } from './PriceCard'

const meta: Meta<typeof PriceCard> = {
  title: 'Components/PriceCard',
  component: PriceCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta
type Story = StoryObj<typeof PriceCard>

const basePrice = {
  assetPair: 'XLM/USD',
  price: 0.12345,
  timestamp: Date.now() - 5000,
  confidence: 0.98,
  sources: ['chainlink', 'redstone', 'band', 'reflector'],
}

export const Default: Story = {
  args: { price: basePrice },
}

export const WithAlert: Story = {
  args: { price: basePrice, hasAlert: true },
}

export const Stale: Story = {
  args: { price: { ...basePrice, timestamp: Date.now() - 120_000 }, isStale: true },
}

export const SingleSource: Story = {
  args: { price: { ...basePrice, sources: ['chainlink'], confidence: 0.72 } },
}

export const Selected: Story = {
  args: { price: basePrice, selectMode: true, isSelected: true },
}
