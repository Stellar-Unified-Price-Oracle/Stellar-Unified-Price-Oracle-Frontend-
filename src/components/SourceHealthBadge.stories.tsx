import type { Meta, StoryObj } from '@storybook/react-vite'
import { SourceHealthBadge } from './SourceHealthBadge'

const meta: Meta<typeof SourceHealthBadge> = {
  title: 'Components/SourceHealthBadge',
  component: SourceHealthBadge,
}

export default meta
type Story = StoryObj<typeof SourceHealthBadge>

/** All four known oracle sources contributing. */
export const AllSources: Story = {
  args: { sources: ['chainlink', 'redstone', 'band', 'reflector'] },
}

/** A single source. */
export const SingleSource: Story = {
  args: { sources: ['chainlink'] },
}

/** No sources yet — the aggregator is still initialising. */
export const Empty: Story = {
  args: { sources: [] },
}
