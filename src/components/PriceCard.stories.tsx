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
export const Validating: Story = { args: { price, isValidating: true } }
export const LowConfidence: Story = {
  args: { price: { ...price, confidence: 0.55, sources: ['chainlink'] } },
}
export const SingleSource: Story = {
  args: { price: { ...price, sources: ['reflector'] } },
}
export const AllSources: Story = {
  args: { price: { ...price, sources: ['chainlink', 'redstone', 'band', 'reflector'] } },
}
