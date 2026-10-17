import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SDK_MIGRATIONS } from '../data/sdkMigrations'
import { SdkMigrationGuide } from './SdkMigrationGuide'

afterEach(cleanup)

describe('SdkMigrationGuide (#809)', () => {
  it('renders one disclosure per documented major with its breaking changes', () => {
    render(<SdkMigrationGuide />)

    expect(screen.getByRole('heading', { name: 'SDK migration guide' })).toBeInTheDocument()
    expect(screen.getByText(/Supported majors: v1/)).toBeInTheDocument()
    for (const migration of SDK_MIGRATIONS) {
      expect(screen.getByText(migration.title).closest('details')).toBeInTheDocument()
      for (const change of migration.breakingChanges) {
        expect(screen.getByText(change)).toBeInTheDocument()
      }
    }
  })

  it('shows the before and after code for each example as keyboard-focusable blocks', () => {
    render(<SdkMigrationGuide />)

    const afterBlock = screen.getByLabelText('Fetch one pair: after')
    expect(afterBlock.tagName).toBe('PRE')
    expect(afterBlock).toHaveAttribute('tabindex', '0')
    expect(afterBlock).toHaveTextContent("await client.getPrice('XLM-USD')")
    expect(screen.getByLabelText('Fetch one pair: before')).toHaveTextContent('await fetch(')
  })
})
