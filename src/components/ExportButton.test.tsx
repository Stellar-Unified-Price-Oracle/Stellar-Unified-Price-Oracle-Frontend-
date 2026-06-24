import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ExportButton } from './ExportButton'

afterEach(() => cleanup())

describe('ExportButton', () => {
  it('renders export button', () => {
    render(<ExportButton onExport={vi.fn()} exporting={false} />)
    expect(screen.getByRole('button', { name: 'Export data' })).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<ExportButton onExport={vi.fn()} exporting={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Export data' }))
    expect(screen.getByText('Export as CSV')).toBeInTheDocument()
    expect(screen.getByText('Export as JSON')).toBeInTheDocument()
  })

  it('calls onExport with csv', () => {
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} exporting={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Export data' }))
    fireEvent.click(screen.getByText('Export as CSV'))
    expect(onExport).toHaveBeenCalledWith('csv')
  })

  it('calls onExport with json', () => {
    const onExport = vi.fn()
    render(<ExportButton onExport={onExport} exporting={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Export data' }))
    fireEvent.click(screen.getByText('Export as JSON'))
    expect(onExport).toHaveBeenCalledWith('json')
  })

  it('disables button when exporting', () => {
    render(<ExportButton onExport={vi.fn()} exporting={true} />)
    expect(screen.getByRole('button', { name: 'Export data' })).toBeDisabled()
  })

  it('disables button when disabled prop is true', () => {
    render(<ExportButton onExport={vi.fn()} exporting={false} disabled={true} />)
    expect(screen.getByRole('button', { name: 'Export data' })).toBeDisabled()
  })
})
