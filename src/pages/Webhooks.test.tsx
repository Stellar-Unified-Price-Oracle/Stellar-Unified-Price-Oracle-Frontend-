import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Webhooks } from './Webhooks'

describe('Webhooks session secret (#843)', () => {
  it('keeps a rotated secret masked until the user reveals it', async () => {
    const user = userEvent.setup()
    render(<Webhooks />)

    await user.click(screen.getByRole('button', { name: 'Rotate secret' }))

    const reveal = screen.getByRole('button', { name: 'Reveal secret' })
    expect(reveal).toHaveAttribute('aria-pressed', 'false')
    const shown = screen.getByText(/Session secret:/)
    expect(shown.textContent).toMatch(/^Session secret: •+.{4}$/)

    await user.click(reveal)

    expect(screen.getByRole('button', { name: 'Hide secret' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Session secret:/).textContent).not.toContain('•')
  })

  it('re-masks a secret when it is rotated again after being revealed', async () => {
    const user = userEvent.setup()
    render(<Webhooks />)

    await user.click(screen.getByRole('button', { name: 'Rotate secret' }))
    await user.click(screen.getByRole('button', { name: 'Reveal secret' }))
    await user.click(screen.getByRole('button', { name: 'Rotate secret' }))

    expect(screen.getByRole('button', { name: 'Reveal secret' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/Session secret:/).textContent).toMatch(/•/)
  })
})
