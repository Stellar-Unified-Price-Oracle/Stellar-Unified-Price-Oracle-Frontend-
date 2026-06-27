import type { Meta, StoryObj } from '@storybook/react'
import { SourceHealthBadge } from './SourceHealthBadge'

const meta: Meta<typeof SourceHealthBadge> = {
  component: SourceHealthBadge,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof SourceHealthBadge>

export const AllSources: Story = { args: { sources: ['chainlink', 'redstone', 'band', 'reflector'] } }
export const SingleSource: Story = { args: { sources: ['chainlink'] } }
export const Empty: Story = { args: { sources: [] } }
