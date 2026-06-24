import type { Meta, StoryObj } from '@storybook/react'
import { SourceHealthBadge } from './SourceHealthBadge'

const meta = {
  title: 'Components/SourceHealthBadge',
  component: SourceHealthBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof SourceHealthBadge>

export default meta
type Story = StoryObj<typeof meta>

export const AllSources: Story = {
  args: {
    sources: ['chainlink', 'redstone', 'band', 'reflector'],
  },
}

export const SingleSource: Story = {
  args: {
    sources: ['chainlink'],
  },
}

export const Empty: Story = {
  args: {
    sources: [],
  },
}
