import type { Meta, StoryObj } from '@storybook/react'
import { PriceCardSkeleton } from './PriceCardSkeleton'

const meta = {
  title: 'Components/PriceCardSkeleton',
  component: PriceCardSkeleton,
  tags: ['autodocs'],
} satisfies Meta<typeof PriceCardSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
