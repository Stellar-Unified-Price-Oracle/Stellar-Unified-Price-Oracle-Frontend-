import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { PriceData } from '../types'
import { PriceCard } from './PriceCard'

const price: PriceData = {
  assetPair: 'BTC/USD',
  price: 50000.1234,
  timestamp: Date.now(),
  confidence: 0.9876,
  sources: ['chainlink', 'redstone', 'band'],
}

const meta: Meta<typeof PriceCard> = {
  title: 'Components/PriceCard',
  component: PriceCard,
  args: {
    price,
    onClick: fn(),
    onAlertClick: fn(),
  },
}

export default meta
type Story = StoryObj<typeof PriceCard>

/** Default populated card with a fresh price update. */
export const Populated: Story = {}

/** A card whose sources array is empty while the aggregator is still initialising. */
export const NoSources: Story = {
  args: { price: { ...price, sources: [] } },
}

/** Rendered at reduced opacity to signal the feed is behind its freshness threshold. */
export const Stale: Story = {
  args: { isStale: true },
}

/** With an active price alert configured for this pair. */
export const WithAlert: Story = {
  args: { hasAlert: true },
}

/** Multi-select mode, unselected. */
export const SelectMode: Story = {
  args: { selectMode: true, isSelected: false },
}

/** Multi-select mode, selected. */
export const SelectModeSelected: Story = {
  args: { selectMode: true, isSelected: true },
}

/** A price update from a few minutes ago — the freshness badge turns red. */
export const AgingData: Story = {
  args: { price: { ...price, timestamp: Date.now() - 5 * 60_000 } },
}
