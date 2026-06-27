import type { Meta, StoryObj } from '@storybook/react'
import { PriceCardSkeleton } from './PriceCardSkeleton'

const meta: Meta<typeof PriceCardSkeleton> = {
  component: PriceCardSkeleton,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PriceCardSkeleton>

export const Default: Story = {}
