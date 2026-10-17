import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SAMPLE_QUOTES } from '../utils/sampleData'
import { SampleDataPreview } from './SampleDataPreview'

describe('SampleDataPreview', () => {
  it('starts collapsed and does not render sample rows', () => {
    render(<SampleDataPreview />)
    const toggle = screen.getByRole('button', { name: 'Show sample data' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('reveals a labelled table of sample prices when opened', () => {
    render(<SampleDataPreview />)
    fireEvent.click(screen.getByRole('button', { name: 'Show sample data' }))

    expect(screen.getByRole('button', { name: 'Hide sample data' })).toHaveAttribute('aria-expanded', 'true')
    const table = screen.getByRole('table', { name: /not live market prices/i })
    expect(table).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(SAMPLE_QUOTES.length + 1)
  })

  it('collapses again when toggled a second time', () => {
    render(<SampleDataPreview />)
    const toggle = screen.getByRole('button', { name: 'Show sample data' })
    fireEvent.click(toggle)
    fireEvent.click(screen.getByRole('button', { name: 'Hide sample data' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
