import type { Meta, StoryObj } from '@storybook/react'
import { PriceCardSkeleton } from './PriceCardSkeleton'

const meta: Meta<typeof PriceCardSkeleton> = {
  title: 'Components/PriceCardSkeleton',
  component: PriceCardSkeleton,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta
type Story = StoryObj<typeof PriceCardSkeleton>

export const Default: Story = {}
