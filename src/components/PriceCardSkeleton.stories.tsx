import type { Meta, StoryObj } from '@storybook/react-vite'
import { PriceCardSkeleton } from './PriceCardSkeleton'

const meta: Meta<typeof PriceCardSkeleton> = {
  title: 'Components/PriceCardSkeleton',
  component: PriceCardSkeleton,
}

export default meta
type Story = StoryObj<typeof PriceCardSkeleton>

/** Loading placeholder shown while the first page of prices is being fetched. */
export const Loading: Story = {}
