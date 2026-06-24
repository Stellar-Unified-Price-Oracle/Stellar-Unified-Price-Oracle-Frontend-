import type { Meta, StoryObj } from '@storybook/react'
import { PriceCard } from './PriceCard'

const meta: Meta<typeof PriceCard> = {
  component: PriceCard,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PriceCard>

const price = {
  assetPair: 'XLM/USD',
  price: 0.1234,
  timestamp: Date.now() - 5000,
  confidence: 0.95,
  sources: ['chainlink', 'redstone'],
}

export const Default: Story = { args: { price } }
export const Stale: Story = { args: { price, isStale: true } }
export const WithAlert: Story = { args: { price, hasAlert: true } }
export const Selected: Story = { args: { price, selectMode: true, isSelected: true } }
