import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TableColumnsDialog } from './TableColumnsDialog'

describe('TableColumnsDialog', () => {
  it('shows every optional column checked when nothing is hidden', () => {
    render(<TableColumnsDialog hidden={[]} onApply={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Confidence' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Sources' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Updated' })).toBeChecked()
  })

  it('previews the resulting columns before anything is applied', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<TableColumnsDialog hidden={[]} onApply={onApply} onClose={vi.fn()} />)

    await user.click(screen.getByRole('checkbox', { name: 'Sources' }))

    const preview = screen.getByRole('table', { name: 'Table column preview' })
    const headers = within(preview)
      .getAllByRole('columnheader')
      .map((th) => th.textContent)
    expect(headers).not.toContain('Sources')
    expect(headers).toContain('Confidence')
    expect(onApply).not.toHaveBeenCalled()
  })

  it('applies the draft in display order and keeps the dialog contract', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<TableColumnsDialog hidden={[]} onApply={onApply} onClose={vi.fn()} />)

    await user.click(screen.getByRole('checkbox', { name: 'Updated' }))
    await user.click(screen.getByRole('checkbox', { name: 'Confidence' }))
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(onApply).toHaveBeenCalledWith(['confidence', 'timestamp'])
  })

  it('cancel and Escape close without applying', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const onClose = vi.fn()
    render(<TableColumnsDialog hidden={[]} onApply={onApply} onClose={onClose} />)

    await user.click(screen.getByRole('checkbox', { name: 'Sources' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(2)
    expect(onApply).not.toHaveBeenCalled()
  })

  it('one-click reset applies the default column set', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(<TableColumnsDialog hidden={['sources', 'timestamp']} onApply={onApply} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Reset to default' }))

    expect(onApply).toHaveBeenCalledWith([])
  })

  it('opens as a labelled modal dialog', () => {
    render(<TableColumnsDialog hidden={[]} onApply={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Table columns' })).toHaveAttribute('aria-modal', 'true')
  })
})
