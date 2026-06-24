import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotFound } from './NotFound'
import { checkAccessibility } from '../test/accessibility'

afterEach(cleanup)

describe('NotFound', () => {
  it('should have no accessibility violations', async () => {
    await checkAccessibility(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )
  })

  it('renders 404 heading', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )
    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  it('renders a link back to dashboard', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )
    const links = screen.getAllByText('Back to Dashboard')
    expect(links).toHaveLength(1)
    expect(links[0].closest('a')).toHaveAttribute('href', '/')
  })
})

describe('snapshots', () => {
  it('default', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
